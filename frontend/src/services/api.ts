import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from '../lib/tokenStorage';
import type { ApiError, TokenResponse } from '../types';

export const API_BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

const AUTH_SKIP_PATHS = ['/auth/login', '/auth/refresh', '/auth/register'];

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_SKIP_PATHS.some((path) => url.includes(path));
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  // Bare axios call so this request bypasses the `api` interceptors.
  const { data } = await axios.post<TokenResponse>(`${API_BASE_URL}/auth/refresh`, {
    refresh_token: refreshToken,
  });
  tokenStorage.setTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

function redirectToLogin(): void {
  tokenStorage.clear();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (status !== 401 || !original || original._retry || isAuthEndpoint(original.url)) {
      return Promise.reject(error);
    }

    if (!tokenStorage.getRefreshToken()) {
      redirectToLogin();
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      // Concurrent 401s share a single in-flight refresh request (queue).
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      original.headers.set('Authorization', `Bearer ${newToken}`);
      return api(original);
    } catch (refreshError) {
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  },
);

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'detail' in value &&
    typeof (value as { detail: unknown }).detail === 'string'
  );
}

/** Extract the backend `error_code` (if any) from an unknown error. */
export function getErrorCode(err: unknown): string | undefined {
  if (axios.isAxiosError(err)) {
    const data: unknown = err.response?.data;
    if (isApiError(data)) return data.error_code;
  }
  return undefined;
}

/** Turn any thrown value into a user-friendly message. */
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data: unknown = err.response?.data;
    if (isApiError(data)) return data.detail;
    // FastAPI validation errors: { detail: [{ msg: string, ... }] }
    if (typeof data === 'object' && data !== null && 'detail' in data) {
      const detail: unknown = (data as { detail: unknown }).detail;
      if (Array.isArray(detail) && detail.length > 0) {
        const first: unknown = detail[0];
        if (typeof first === 'object' && first !== null && 'msg' in first) {
          const msg: unknown = (first as { msg: unknown }).msg;
          if (typeof msg === 'string') return msg;
        }
      }
    }
    if (!err.response) return 'Could not reach the server. Check your connection and try again.';
    return `Request failed (${err.response.status}).`;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

export default api;
