import type { SubmissionErrorCode } from '../../types';

export interface ErrorTip {
  tip: string;
  /** Whether re-running the same submission could plausibly succeed. */
  retryable: boolean;
}

export const ERROR_TIPS: Record<SubmissionErrorCode, ErrorTip> = {
  invalid_repo_url: {
    tip: 'Use a link like https://github.com/owner/repo — then roast another repo.',
    retryable: false,
  },
  repo_not_found_or_private: {
    tip: 'Make the repo public on GitHub (Settings → Danger Zone → Change visibility), then try again.',
    retryable: true,
  },
  branch_not_found: {
    tip: 'Double-check the branch name (case-sensitive), or leave it empty to use the default branch.',
    retryable: false,
  },
  github_rate_limited: {
    tip: 'GitHub is rate limiting us. Try again in a few minutes, machaan.',
    retryable: true,
  },
  repo_too_large: {
    tip: 'Submit a smaller repo or a branch/folder with just the assignment code.',
    retryable: false,
  },
  repo_empty: {
    tip: 'Push some code to the repo first — empty repo-va roast panna mudiyadhu!',
    retryable: true,
  },
  ai_invalid_output: {
    tip: 'Our AI got a bit confused. Trying again usually fixes it.',
    retryable: true,
  },
  ai_unavailable: {
    tip: 'The AI is taking a breather. Try again in a few minutes.',
    retryable: true,
  },
  daily_limit_reached: {
    tip: "You've used today's roasts. Come back after the daily reset.",
    retryable: false,
  },
  already_processing: {
    tip: 'This repo is already being roasted — give it a moment.',
    retryable: false,
  },
  internal_error: {
    tip: 'Something broke on our side. Try again — if it keeps happening, roast another repo.',
    retryable: true,
  },
  invalid_branch: {
    tip: 'Check the branch name — leave it empty to use the default branch.',
    retryable: false,
  },
  github_unavailable: {
    tip: 'GitHub is having a moment. Try again in a few minutes.',
    retryable: true,
  },
  repo_unreadable: {
    tip: "We couldn't read this repo's files. Make sure it has normal source files, then try again.",
    retryable: false,
  },
  rate_limited: {
    tip: 'Too many requests — wait a minute and try again.',
    retryable: true,
  },
};

const FALLBACK_TIP: ErrorTip = {
  tip: 'Try again in a bit, or roast another repo.',
  retryable: true,
};

export function getErrorTip(code: string | null | undefined): ErrorTip {
  if (code && code in ERROR_TIPS) return ERROR_TIPS[code as SubmissionErrorCode];
  return FALLBACK_TIP;
}
