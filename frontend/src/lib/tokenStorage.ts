const ACCESS_KEY = 'ar_access_token';
const REFRESH_KEY = 'ar_refresh_token';

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode / blocked); tokens are not persisted.
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable; nothing to remove.
  }
}

export const tokenStorage = {
  getAccessToken: (): string | null => safeGet(ACCESS_KEY),
  getRefreshToken: (): string | null => safeGet(REFRESH_KEY),
  setTokens: (accessToken: string, refreshToken: string): void => {
    safeSet(ACCESS_KEY, accessToken);
    safeSet(REFRESH_KEY, refreshToken);
  },
  clear: (): void => {
    safeRemove(ACCESS_KEY);
    safeRemove(REFRESH_KEY);
  },
  hasTokens: (): boolean => safeGet(ACCESS_KEY) !== null,
};

export default tokenStorage;
