import type { ReactElement } from 'react';
import { HomePage } from './pages/HomePage';
import { ProtectedRoute, PublicOnlyRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { ProfilePage } from './pages/ProfilePage';
import { DashboardPage } from './pages/DashboardPage';
import { NewRoastPage } from './pages/NewRoastPage';
import { SubmissionsPage } from './pages/SubmissionsPage';
import { SubmissionDetailPage } from './pages/SubmissionDetailPage';
import { SettingsPage } from './pages/SettingsPage';

export interface AppRoute {
  path: string;
  element: ReactElement;
}

/**
 * Routes rendered inside <AppLayout /> (navbar + page).
 * Phase 2: append auth / submission / dashboard routes here
 * (wrap protected pages in a ProtectedRoute element).
 */
export const layoutRoutes: AppRoute[] = [
  { path: '/', element: <HomePage /> },
  // Auth module
  { path: '/login', element: <PublicOnlyRoute><LoginPage /></PublicOnlyRoute> },
  { path: '/register', element: <PublicOnlyRoute><RegisterPage /></PublicOnlyRoute> },
  { path: '/forgot-password', element: <PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute> },
  { path: '/profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
  // Submissions & roasts + dashboard
  { path: '/dashboard', element: <ProtectedRoute><DashboardPage /></ProtectedRoute> },
  { path: '/roast/new', element: <ProtectedRoute><NewRoastPage /></ProtectedRoute> },
  { path: '/submissions', element: <ProtectedRoute><SubmissionsPage /></ProtectedRoute> },
  { path: '/submissions/:id', element: <ProtectedRoute><SubmissionDetailPage /></ProtectedRoute> },
  { path: '/settings', element: <ProtectedRoute><SettingsPage /></ProtectedRoute> },
];

/** Routes rendered without the app layout (e.g. full-screen OAuth callback). */
export const standaloneRoutes: AppRoute[] = [
  { path: '/auth/callback', element: <OAuthCallbackPage /> },
];
