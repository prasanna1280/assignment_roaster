import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AdminRoute, ProtectedRoute, PublicOnlyRoute } from '../../components/auth/ProtectedRoute';
import { authService } from '../../services/authService';
import { tokenStorage } from '../../lib/tokenStorage';
import { mockUser, renderWithProviders } from '../testUtils';
import type { AuthContextValue } from '../../context/authContextValue';

function LoginProbe() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
  return <p>Login page (from {from ?? 'nowhere'})</p>;
}

function renderGuarded(route: string, authValue?: Partial<AuthContextValue>) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginProbe />} />
      <Route path="/dashboard" element={<p>Dashboard page</p>} />
      <Route path="/secret" element={<ProtectedRoute><p>Secret content</p></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><p>Admin content</p></AdminRoute>} />
      <Route path="/public" element={<PublicOnlyRoute><p>Public content</p></PublicOnlyRoute>} />
    </Routes>,
    { route, authValue },
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => tokenStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('redirects to /login (remembering the origin) when logged out', async () => {
    renderGuarded('/secret');
    expect(await screen.findByText('Login page (from /secret)')).toBeInTheDocument();
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
  });

  it('renders children when logged in', () => {
    renderGuarded('/secret', { user: mockUser });
    expect(screen.getByText('Secret content')).toBeInTheDocument();
  });

  it('shows a spinner while auth is loading', () => {
    renderGuarded('/secret', { isLoading: true });
    expect(screen.getByRole('status', { name: /checking your session/i })).toBeInTheDocument();
  });

  it('restores the session from stored tokens via /auth/me', async () => {
    tokenStorage.setTokens('a', 'r');
    vi.spyOn(authService, 'getMe').mockResolvedValue(mockUser);
    renderGuarded('/secret');
    expect(await screen.findByText('Secret content')).toBeInTheDocument();
  });
});

describe('AdminRoute', () => {
  it('redirects non-admins to /dashboard', () => {
    renderGuarded('/admin', { user: mockUser });
    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
  });

  it('renders for admins', () => {
    renderGuarded('/admin', { user: { ...mockUser, is_admin: true } });
    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });
});

describe('PublicOnlyRoute', () => {
  it('redirects authenticated users to /dashboard', () => {
    renderGuarded('/public', { user: mockUser });
    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
  });

  it('renders for anonymous users', () => {
    renderGuarded('/public', { user: null });
    expect(screen.getByText('Public content')).toBeInTheDocument();
  });
});
