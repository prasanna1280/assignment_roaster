import type { ReactElement, ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from '../theme';
import { AuthProvider } from '../context/AuthContext';
import { AuthContext, type AuthContextValue } from '../context/authContextValue';
import type { User } from '../types';

interface RenderOptions {
  route?: string;
  /** Location state for the initial route (e.g. `{ from: { pathname: '/x' } }`). */
  routeState?: unknown;
  /** Wrap in the real <AuthProvider> (default true). Ignored when `authValue` is given. */
  withAuth?: boolean;
  /** Provide a (partial) mocked auth context instead of the real AuthProvider. */
  authValue?: Partial<AuthContextValue>;
}

export const mockUser: User = {
  id: 1,
  email: 'kavya@example.com',
  full_name: 'Kavya Raman',
  avatar_url: null,
  is_active: true,
  is_verified: true,
  is_admin: false,
  oauth_provider: null,
  created_at: '2026-01-01T00:00:00Z',
};

/** Build a complete AuthContextValue with no-op actions; override any field. */
export function createMockAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const user = overrides.user ?? null;
  return {
    user,
    isLoading: false,
    isAuthenticated: user !== null,
    login: async () => mockUser,
    register: async () => mockUser,
    logout: async () => undefined,
    loginWithGoogle: () => undefined,
    completeOAuth: async () => mockUser,
    refreshUser: async () => user,
    updateProfile: async () => mockUser,
    ...overrides,
  };
}

/** Render a component with Chakra, React Query, a MemoryRouter and (by default) auth. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', routeState, withAuth = true, authValue }: RenderOptions = {},
): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const initialEntry = routeState === undefined ? route : { pathname: route, state: routeState };

  function AuthLayer({ children }: { children: ReactNode }) {
    if (authValue) {
      return <AuthContext.Provider value={createMockAuth(authValue)}>{children}</AuthContext.Provider>;
    }
    if (withAuth) return <AuthProvider>{children}</AuthProvider>;
    return <>{children}</>;
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ChakraProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[initialEntry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthLayer>{children}</AuthLayer>
          </MemoryRouter>
        </QueryClientProvider>
      </ChakraProvider>
    );
  }
  return render(ui, { wrapper: Wrapper });
}
