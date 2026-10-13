import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { LoginForm } from '../../components/auth/LoginForm';
import { LoginPage } from '../../pages/LoginPage';
import { authService } from '../../services/authService';
import { tokenStorage } from '../../lib/tokenStorage';
import { mockUser, renderWithProviders } from '../testUtils';
import { apiError, tokens } from './helpers';

function renderLogin(routeState?: unknown) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginForm />} />
      <Route path="/dashboard" element={<p>Dashboard page</p>} />
      <Route path="/submissions/7" element={<p>Submission 7 page</p>} />
    </Routes>,
    { route: '/login', routeState },
  );
}

describe('LoginForm', () => {
  beforeEach(() => tokenStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('shows validation errors and does not call the API when empty', async () => {
    const loginSpy = vi.spyOn(authService, 'login');
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /login pannunga/i }));

    expect(await screen.findByText(/please enter your email/i)).toBeInTheDocument();
    expect(screen.getByText(/please enter your password/i)).toBeInTheDocument();
    expect(loginSpy).not.toHaveBeenCalled();
  });

  it('rejects a malformed email', async () => {
    const loginSpy = vi.spyOn(authService, 'login');
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'not-an-email');
    await userEvent.type(screen.getByLabelText(/^password/i), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /login pannunga/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(loginSpy).not.toHaveBeenCalled();
  });

  it('logs in, stores tokens and navigates to /dashboard', async () => {
    const loginSpy = vi.spyOn(authService, 'login').mockResolvedValue(tokens);
    vi.spyOn(authService, 'getMe').mockResolvedValue(mockUser);
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), 'kavya@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /login pannunga/i }));

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(loginSpy).toHaveBeenCalledWith({ email: 'kavya@example.com', password: 'secret123' });
    expect(tokenStorage.getAccessToken()).toBe(tokens.access_token);
    expect(tokenStorage.getRefreshToken()).toBe(tokens.refresh_token);
  });

  it('returns to the page the user came from', async () => {
    vi.spyOn(authService, 'login').mockResolvedValue(tokens);
    vi.spyOn(authService, 'getMe').mockResolvedValue(mockUser);
    renderLogin({ from: { pathname: '/submissions/7', search: '', hash: '' } });

    await userEvent.type(screen.getByLabelText(/email/i), 'kavya@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /login pannunga/i }));

    expect(await screen.findByText('Submission 7 page')).toBeInTheDocument();
  });

  it('maps invalid_credentials to a friendly message', async () => {
    vi.spyOn(authService, 'login').mockRejectedValue(
      apiError(401, { detail: 'Invalid credentials', error_code: 'invalid_credentials' }),
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), 'kavya@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /login pannunga/i }));

    expect(await screen.findByText(/email or password thappu/i)).toBeInTheDocument();
    await waitFor(() => expect(tokenStorage.getAccessToken()).toBeNull());
  });
});

describe('LoginPage', () => {
  beforeEach(() => tokenStorage.clear());

  it('shows a friendly alert for ?error=oauth_failed', () => {
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      </Routes>,
      { route: '/login?error=oauth_failed' },
    );
    expect(screen.getByText(/google login fail aagiduchu/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign up pannunga/i })).toHaveAttribute('href', '/register');
  });
});
