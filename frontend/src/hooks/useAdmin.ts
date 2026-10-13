import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../services/adminService';
import type { AdminUserUpdate, SubmissionStatus } from '../types';

export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  userList: (page: number, size: number, search: string) =>
    [...adminKeys.users(), page, size, search] as const,
  submissions: (page: number, size: number, status: SubmissionStatus | '') =>
    [...adminKeys.all, 'submissions', page, size, status] as const,
};

export function useAdminStats() {
  return useQuery({ queryKey: adminKeys.stats(), queryFn: () => adminService.getStats() });
}

export function useAdminUsers(page: number, size: number, search: string) {
  return useQuery({
    queryKey: adminKeys.userList(page, size, search),
    queryFn: () => adminService.listUsers(page, size, search || undefined),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: AdminUserUpdate }) =>
      adminService.updateUser(id, payload),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useAdminSubmissions(page: number, size: number, status: SubmissionStatus | '') {
  return useQuery({
    queryKey: adminKeys.submissions(page, size, status),
    queryFn: () => adminService.listSubmissions(page, size, status || undefined),
    placeholderData: keepPreviousData,
  });
}
