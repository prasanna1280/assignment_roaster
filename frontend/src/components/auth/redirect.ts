interface FromState {
  from?: { pathname?: unknown; search?: unknown; hash?: unknown };
}

const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/auth/callback'];

/** Where to go after auth: the page the user was bounced from, else /dashboard. */
export function getRedirectPath(state: unknown): string {
  const from = (state as FromState | null)?.from;
  if (from && typeof from.pathname === 'string' && !AUTH_PAGES.includes(from.pathname)) {
    const search = typeof from.search === 'string' ? from.search : '';
    const hash = typeof from.hash === 'string' ? from.hash : '';
    return `${from.pathname}${search}${hash}`;
  }
  return '/dashboard';
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Parse `#access_token=...&refresh_token=...` from the URL fragment. */
export function parseOAuthHash(hash: string): OAuthTokens | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}
