import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { App } from '../App';
import { HomePage } from '../pages/HomePage';
import { getErrorMessage } from '../services/api';
import { renderWithProviders } from './testUtils';

describe('HomePage', () => {
  it('renders the hero and CTA', () => {
    renderWithProviders(<HomePage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /honest code reviews that students actually read/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /roast my repo/i })).toHaveAttribute('href', '/roast/new');
    expect(screen.getByRole('meter', { name: /sample overall score/i })).toBeInTheDocument();
  });
});

describe('App routing', () => {
  it('renders navbar and home at /', () => {
    renderWithProviders(<App />, { route: '/' });
    expect(screen.getByRole('link', { name: /assignment roaster home/i })).toBeInTheDocument();
    // Logged out: auth-aware navbar shows Login / Sign up instead of app links.
    expect(screen.getAllByRole('link', { name: 'Log in', hidden: true }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Dashboard', hidden: true })).not.toBeInTheDocument();
  });

  it('renders NotFoundPage for unknown routes', () => {
    renderWithProviders(<App />, { route: '/does-not-exist' });
    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument();
  });
});

describe('getErrorMessage', () => {
  it('falls back for unknown values', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage(42)).toMatch(/something went wrong/i);
  });
});
