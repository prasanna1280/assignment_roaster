import axios from 'axios';
import { api, API_BASE_URL, getErrorCode, getErrorMessage } from './api';
import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  UpdateProfileRequest,
  User,
} from '../types';

/** Friendly copy for backend auth `error_code` values. */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  account_disabled: 'This account is disabled. Please contact support.',
  email_taken: 'An account with this email already exists. Please log in.',
  rate_limited: 'Too many attempts. Please wait a minute and try again.',
  google_not_configured: 'Google sign-in is not available right now. Please use email.',
  oauth_state: 'Your Google sign-in session expired. Please try again.',
  oauth_failed: 'Google sign-in failed. Please try again later.',
};

export const authService = {
  register: async (payload: RegisterRequest): Promise<TokenResponse> => {
    const { data } = await api.post<TokenResponse>('/auth/register', payload);
    return data;
  },

  login: async (payload: LoginRequest): Promise<TokenResponse> => {
    const { data } = await api.post<TokenResponse>('/auth/login', payload);
    return data;
  },

  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    const { data } = await api.post<TokenResponse>('/auth/refresh', { refresh_token: refreshToken });
    return data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    await api.post('/auth/logout', { refresh_token: refreshToken });
  },

  getMe: async (): Promise<User> => {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  updateMe: async (payload: UpdateProfileRequest): Promise<User> => {
    const { data } = await api.put<User>('/auth/me', payload);
    return data;
  },

  /** Full-page URL that starts the Google OAuth flow (<VITE_API_URL>/api/v1/auth/google). */
  googleLoginUrl: (): string => `${API_BASE_URL}/auth/google`,
};

/** Map an auth request error to friendly copy (uses backend `error_code` when present). */
export function getAuthErrorMessage(err: unknown): string {
  const code = getErrorCode(err);
  const mapped = code ? AUTH_ERROR_MESSAGES[code] : undefined;
  if (mapped) return mapped;
  if (axios.isAxiosError(err) && err.response?.status === 429) {
    return AUTH_ERROR_MESSAGES.rate_limited ?? getErrorMessage(err);
  }
  return getErrorMessage(err);
}

export default authService;
