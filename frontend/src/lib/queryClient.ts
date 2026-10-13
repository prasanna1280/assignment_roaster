import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    // Don't retry client errors (validation, auth, not found, rate limit).
    if (status !== undefined && status >= 400 && status < 500) return false;
  }
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
