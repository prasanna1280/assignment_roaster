import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { RegisterForm } from '../../components/auth/RegisterForm';
import { authService } from '../../services/authService';
import { tokenStorage } from '../../lib/tokenStorage';
import { mockUser, renderWithProviders } from '../testUtils';
import { apiError, tokens } from './helpers';

function renderRegister() {
  return renderWithProviders(
    <Routes>
      <Route path="/register" element={<RegisterForm />} />
      <Route path="/dashboard" element={<p>Dashboard page</p>} />
    </Routes>,
    { route: '/register' },
  );
}

async function fillForm(name: string, email: string, password: string) {
  if (name) await userEvent.type(screen.getByLabelText(/full name/i), name);
  if (email) await userEvent.type(screen.getByLabelText(/^email/i), email);
  if (password) await userEvent.type(screen.getByLabelText(/^password/i), password);
  await userEvent.click(screen.getByRole('button', { name: /create account/i }));
}

describe('RegisterForm', () => {
  beforeEach(() => tokenStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('validates name, email and password length', async () => {
    const registerSpy = vi.spyOn(authService, 'register');
    renderRegister();
    await fillForm('', 'bad-email', 'short');

    expect(await screen.findByText(/full name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(registerSpy).not.toHaveBeenCalled();
  });

  it('shows a friendly message when the email is taken', async () => {
    vi.spyOn(authService, 'register').mockRejectedValue(
      apiError(409, { detail: 'Email already registered', error_code: 'email_taken' }),
    );
    renderRegister();
    await fillForm('Kavya Raman', 'kavya@example.com', 'secret123');

    expect(await screen.findByText(/already exists\. please log in/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to login/i })).toHaveAttribute('href', '/login');
  });

  it('registers and navigates to /dashboard', async () => {
    const registerSpy = vi.spyOn(authService, 'register').mockResolvedValue(tokens);
    vi.spyOn(authService, 'getMe').mockResolvedValue(mockUser);
    renderRegister();
    await fillForm('Kavya Raman', 'kavya@example.com', 'secret123');

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(registerSpy).toHaveBeenCalledWith({
      full_name: 'Kavya Raman',
      email: 'kavya@example.com',
      password: 'secret123',
    });
  });
});
