import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { AdminDashboardPage } from '../../pages/AdminDashboardPage';
import { AdminUsersPage } from '../../pages/AdminUsersPage';
import { AdminSubmissionsPage } from '../../pages/AdminSubmissionsPage';
import { AdminRoute } from '../../components/auth/ProtectedRoute';
import { adminService } from '../../services/adminService';
import { mockUser, renderWithProviders } from '../testUtils';
import type { AdminStats, AdminSubmission, AdminUser, User } from '../../types';

vi.mock('../../services/adminService', () => ({
  adminService: {
    getStats: vi.fn(),
    listUsers: vi.fn(),
    updateUser: vi.fn(),
    listSubmissions: vi.fn(),
  },
}));

const mocked = vi.mocked(adminService);
const adminUser: User = { ...mockUser, id: 1, is_admin: true, email: 'admin@example.com' };

const stats: AdminStats = {
  total_users: 12,
  active_users: 11,
  total_submissions: 40,
  submissions_by_status: { queued: 1, fetching: 0, analyzing: 1, completed: 30, failed: 8 },
  failure_rate: 8 / 38,
  total_roasts: 33,
  roasts_today: 4,
  roasts_per_day: [
    { day: '2026-10-07', count: 2 },
    { day: '2026-10-08', count: 0 },
    { day: '2026-10-09', count: 5 },
    { day: '2026-10-10', count: 3 },
    { day: '2026-10-11', count: 1 },
    { day: '2026-10-12', count: 6 },
    { day: '2026-10-13', count: 4 },
  ],
  average_score: 6.42,
  total_input_tokens: 1234567,
  total_output_tokens: 98765,
};

function makeAdminUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 2,
    email: 'student@example.com',
    full_name: 'Student One',
    is_active: true,
    is_admin: false,
    oauth_provider: null,
    submission_count: 3,
    created_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

const submission: AdminSubmission = {
  id: 9,
  user_id: 2,
  user_email: 'student@example.com',
  repo_url: 'https://github.com/kavya/todo-api',
  repo_owner: 'kavya',
  repo_name: 'todo-api',
  status: 'failed',
  error_code: 'repo_not_found_or_private',
  overall_score: null,
  created_at: '2026-10-12T00:00:00Z',
  completed_at: null,
};

function renderAt(route: string, user: User = adminUser) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
      <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
      <Route path="/admin/submissions" element={<AdminRoute><AdminSubmissionsPage /></AdminRoute>} />
      <Route path="/dashboard" element={<div>Student dashboard</div>} />
    </Routes>,
    { route, authValue: { user } },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminRoute', () => {
  it('redirects non-admins to the dashboard without calling the API', async () => {
    renderAt('/admin', { ...mockUser, is_admin: false });
    expect(await screen.findByText('Student dashboard')).toBeInTheDocument();
    expect(mocked.getStats).not.toHaveBeenCalled();
  });
});

describe('AdminDashboardPage', () => {
  it('renders platform stats and the roasts-per-day chart table', async () => {
    mocked.getStats.mockResolvedValue(stats);
    renderAt('/admin');

    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByText('11 active')).toBeInTheDocument();
    expect(screen.getByText('21.1%')).toBeInTheDocument();
    expect(screen.getByText('1,234,567')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: /roasts per day/i });
    expect(within(table).getAllByRole('row')).toHaveLength(8);
  });

  it('shows an error with retry when stats fail', async () => {
    mocked.getStats.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(stats);
    const user = userEvent.setup();
    renderAt('/admin');

    await user.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByText('11 active')).toBeInTheDocument();
  });
});

describe('AdminUsersPage', () => {
  it('lists users and deactivates one', async () => {
    const student = makeAdminUser();
    mocked.listUsers.mockResolvedValue({
      items: [makeAdminUser({ id: 1, email: 'admin@example.com', is_admin: true }), student],
      total: 2,
      page: 1,
      size: 20,
    });
    mocked.updateUser.mockResolvedValue({ ...student, is_active: false });
    const user = userEvent.setup();
    renderAt('/admin/users');

    expect(await screen.findByText('student@example.com')).toBeInTheDocument();
    // An admin can't toggle their own account.
    expect(screen.getByRole('checkbox', { name: 'Active: admin@example.com' })).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'Active: student@example.com' }));
    await waitFor(() => expect(mocked.updateUser).toHaveBeenCalledWith(2, { is_active: false }));
  });

  it('searches users after typing (debounced)', async () => {
    mocked.listUsers.mockResolvedValue({ items: [makeAdminUser()], total: 1, page: 1, size: 20 });
    const user = userEvent.setup();
    renderAt('/admin/users');

    await screen.findByText('student@example.com');
    await user.type(screen.getByLabelText('Search users'), 'stud');
    await waitFor(() => expect(mocked.listUsers).toHaveBeenLastCalledWith(1, 20, 'stud'));
  });
});

describe('AdminSubmissionsPage', () => {
  it('lists submissions and filters by status', async () => {
    mocked.listSubmissions.mockResolvedValue({ items: [submission], total: 1, page: 1, size: 20 });
    const user = userEvent.setup();
    renderAt('/admin/submissions');

    expect(await screen.findByText('kavya/todo-api')).toBeInTheDocument();
    expect(screen.getByText('repo_not_found_or_private')).toBeInTheDocument();
    expect(mocked.listSubmissions).toHaveBeenCalledWith(1, 20, undefined);

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'failed');
    await waitFor(() => expect(mocked.listSubmissions).toHaveBeenLastCalledWith(1, 20, 'failed'));
  });
});
