import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { OAuthCallbackPage } from '../../pages/OAuthCallbackPage';
import { parseOAuthHash } from '../../components/auth/redirect';
import { authService } from '../../services/authService';
import { tokenStorage } from '../../lib/tokenStorage';
import { mockUser, renderWithProviders } from '../testUtils';

function renderCallback() {
  return renderWithProviders(
    <Routes>
      <Route path="/auth/callback" element={<OAuthCallbackPage />} />
      <Route path="/dashboard" element={<p>Dashboard page</p>} />
    </Routes>,
    { route: '/auth/callback' },
  );
}

describe('OAuthCallbackPage', () => {
  beforeEach(() => tokenStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('stores tokens from the URL fragment, clears the hash and goes to /dashboard', async () => {
    window.history.replaceState(null, '', '/auth/callback#access_token=acc-1&refresh_token=ref-2&token_type=bearer');
    const getMe = vi.spyOn(authService, 'getMe').mockResolvedValue(mockUser);
    renderCallback();

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(tokenStorage.getAccessToken()).toBe('acc-1');
    expect(tokenStorage.getRefreshToken()).toBe('ref-2');
    expect(getMe).toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('shows an error state when tokens are missing', async () => {
    window.history.replaceState(null, '', '/auth/callback');
    renderCallback();

    expect(await screen.findByRole('heading', { name: /login aagala/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to login/i })).toHaveAttribute('href', '/login');
    expect(tokenStorage.getAccessToken()).toBeNull();
  });
});

describe('parseOAuthHash', () => {
  it('parses both tokens or returns null', () => {
    expect(parseOAuthHash('#access_token=a&refresh_token=b')).toEqual({ accessToken: 'a', refreshToken: 'b' });
    expect(parseOAuthHash('#access_token=a')).toBeNull();
    expect(parseOAuthHash('')).toBeNull();
  });
});
