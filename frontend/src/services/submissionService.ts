import { api } from './api';
import type { Paginated, Quota, ReroastOptions, Submission, SubmissionCreate } from '../types';

/** Typed client for the /submissions endpoints. */
export const submissionService = {
  async create(payload: SubmissionCreate): Promise<Submission> {
    const { data } = await api.post<Submission>('/submissions', payload);
    return data;
  },

  async list(page = 1, size = 10): Promise<Paginated<Submission>> {
    const { data } = await api.get<Paginated<Submission>>('/submissions', {
      params: { page, size: Math.min(Math.max(size, 1), 50) },
    });
    return data;
  },

  async getQuota(): Promise<Quota> {
    const { data } = await api.get<Quota>('/submissions/quota');
    return data;
  },

  async get(id: number): Promise<Submission> {
    const { data } = await api.get<Submission>(`/submissions/${id}`);
    return data;
  },

  async reroast(id: number, options: ReroastOptions = {}): Promise<Submission> {
    const { data } = await api.post<Submission>(`/submissions/${id}/reroast`, options);
    return data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/submissions/${id}`);
  },
};

export default submissionService;
