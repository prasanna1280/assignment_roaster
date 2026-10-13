import { createContext } from 'react';
import type { LoginRequest, RegisterRequest, UpdateProfileRequest, User } from '../types';

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<User>;
  register: (payload: RegisterRequest) => Promise<User>;
  logout: () => Promise<void>;
  loginWithGoogle: () => void;
  completeOAuth: (accessToken: string, refreshToken: string) => Promise<User>;
  refreshUser: () => Promise<User | null>;
  updateProfile: (payload: UpdateProfileRequest) => Promise<User>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
