import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthContext, type AuthContextValue } from './authContextValue';
import { authService } from '../services/authService';
import { api, getErrorCode } from '../services/api';
import { tokenStorage } from '../lib/tokenStorage';
import type { LoginRequest, RegisterRequest, TokenResponse, UpdateProfileRequest, User } from '../types';

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => tokenStorage.hasTokens());

  // Restore the session on mount (api.ts refreshes the access token on 401).
  useEffect(() => {
    if (!tokenStorage.hasTokens()) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    authService
      .getMe()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        if (!cancelled) {
          tokenStorage.clear();
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A deactivated account gets 403 account_disabled from any authed endpoint: log out locally.
  // (Refresh failures — 401 invalid_refresh_token / 403 — are already handled by api.ts,
  // which clears tokens and redirects to /login. This provider never calls /auth/refresh itself.)
  useEffect(() => {
    const id = api.interceptors.response.use(undefined, (error: unknown) => {
      if (getErrorCode(error) === 'account_disabled' && tokenStorage.hasTokens()) {
        tokenStorage.clear();
        setUser(null);
        queryClient.clear();
      }
      return Promise.reject(error);
    });
    return () => api.interceptors.response.eject(id);
  }, [queryClient]);

  const acceptTokens = useCallback(async (tokens: Pick<TokenResponse, 'access_token' | 'refresh_token'>) => {
    tokenStorage.setTokens(tokens.access_token, tokens.refresh_token);
    try {
      const me = await authService.getMe();
      setUser(me);
      return me;
    } catch (err) {
      tokenStorage.clear();
      setUser(null);
      throw err;
    }
  }, []);

  const login = useCallback(
    async (credentials: LoginRequest) => acceptTokens(await authService.login(credentials)),
    [acceptTokens],
  );

  const register = useCallback(
    async (payload: RegisterRequest) => acceptTokens(await authService.register(payload)),
    [acceptTokens],
  );

  const completeOAuth = useCallback(
    async (accessToken: string, refreshToken: string) =>
      acceptTokens({ access_token: accessToken, refresh_token: refreshToken }),
    [acceptTokens],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } catch {
      // Best effort: the session is cleared locally regardless.
    } finally {
      tokenStorage.clear();
      setUser(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const loginWithGoogle = useCallback(() => {
    window.location.assign(authService.googleLoginUrl());
  }, []);

  const refreshUser = useCallback(async () => {
    if (!tokenStorage.hasTokens()) {
      setUser(null);
      return null;
    }
    try {
      const me = await authService.getMe();
      setUser(me);
      return me;
    } catch {
      return null;
    }
  }, []);

  const updateProfile = useCallback(async (payload: UpdateProfileRequest) => {
    const updated = await authService.updateMe(payload);
    setUser(updated);
    return updated;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
      loginWithGoogle,
      completeOAuth,
      refreshUser,
      updateProfile,
    }),
    [user, isLoading, login, register, logout, loginWithGoogle, completeOAuth, refreshUser, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
