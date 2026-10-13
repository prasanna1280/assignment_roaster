import { api } from './api';
import type {
  AdminStats,
  AdminSubmission,
  AdminUser,
  AdminUserUpdate,
  Paginated,
  SubmissionStatus,
} from '../types';

/** Typed client for the /admin endpoints (admin users only). */
export const adminService = {
  async getStats(): Promise<AdminStats> {
    const { data } = await api.get<AdminStats>('/admin/stats');
    return data;
  },

  async listUsers(page = 1, size = 20, search?: string): Promise<Paginated<AdminUser>> {
    const { data } = await api.get<Paginated<AdminUser>>('/admin/users', {
      params: { page, size, ...(search ? { search } : {}) },
    });
    return data;
  },

  async updateUser(id: number, payload: AdminUserUpdate): Promise<AdminUser> {
    const { data } = await api.put<AdminUser>(`/admin/users/${id}`, payload);
    return data;
  },

  async listSubmissions(
    page = 1,
    size = 20,
    status?: SubmissionStatus,
  ): Promise<Paginated<AdminSubmission>> {
    const { data } = await api.get<Paginated<AdminSubmission>>('/admin/submissions', {
      params: { page, size, ...(status ? { status } : {}) },
    });
    return data;
  },
};

export default adminService;
