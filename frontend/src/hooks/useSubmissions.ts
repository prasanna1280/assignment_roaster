import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { submissionService } from '../services/submissionService';
import type { ReroastOptions, Submission, SubmissionCreate, SubmissionStatus } from '../types';

export interface ReroastVariables {
  id: number;
  options?: ReroastOptions;
}

export const submissionKeys = {
  all: ['submissions'] as const,
  lists: () => [...submissionKeys.all, 'list'] as const,
  list: (page: number, size: number) => [...submissionKeys.lists(), page, size] as const,
  detail: (id: number) => [...submissionKeys.all, 'detail', id] as const,
  quota: () => [...submissionKeys.all, 'quota'] as const,
};

export const POLL_INTERVAL_MS = 2000;

/** True when a submission will no longer change on its own. */
export function isTerminalStatus(status: SubmissionStatus | null | undefined): boolean {
  return status === 'completed' || status === 'failed';
}

/** Polling interval as a function of the latest data (exported for testing). */
export function submissionRefetchInterval(data: Submission | undefined): number | false {
  if (!data) return false;
  return isTerminalStatus(data.status) ? false : POLL_INTERVAL_MS;
}

/** Fetch a submission, polling every 2s until it completes or fails. */
export function useSubmission(id: number | undefined) {
  const enabled = typeof id === 'number' && Number.isFinite(id) && id > 0;
  return useQuery({
    queryKey: submissionKeys.detail(id ?? 0),
    queryFn: () => submissionService.get(id as number),
    enabled,
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.status === 'error' ? false : submissionRefetchInterval(query.state.data),
  });
}

/** Alias matching the PRP naming. */
export const useSubmissionPolling = useSubmission;

export function useSubmissionsList(page = 1, size = 10) {
  return useQuery({
    queryKey: submissionKeys.list(page, size),
    queryFn: () => submissionService.list(page, size),
    placeholderData: keepPreviousData,
  });
}

export function useQuota() {
  return useQuery({
    queryKey: submissionKeys.quota(),
    queryFn: () => submissionService.getQuota(),
  });
}

export function useCreateSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmissionCreate) => submissionService.create(payload),
    onSuccess: (submission) => {
      queryClient.setQueryData(submissionKeys.detail(submission.id), submission);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: submissionKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: submissionKeys.quota() });
    },
  });
}

export function useReroast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, options }: ReroastVariables) => submissionService.reroast(id, options),
    onSuccess: (submission) => {
      queryClient.setQueryData(submissionKeys.detail(submission.id), submission);
    },
    onSettled: (_data, _error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: submissionKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: submissionKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: submissionKeys.quota() });
    },
  });
}

export function useDeleteSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => submissionService.remove(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: submissionKeys.detail(id) });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: submissionKeys.lists() });
    },
  });
}
