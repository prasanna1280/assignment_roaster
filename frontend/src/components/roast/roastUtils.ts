import type { CategoryScores, Improvement, Quota, Severity, SubmissionStatus } from '../../types';

/** Backend sends Decimal scores which may arrive as strings — coerce safely to 0–10. */
export function toScore(value: number | string | null | undefined): number {
  const n = typeof value === 'string' ? Number.parseFloat(value) : (value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.min(10, Math.max(0, n));
}

export function formatScore(value: number | string | null | undefined): string {
  const score = toScore(value);
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

/** Chakra palette colour token for a 0–10 score. */
export function scoreColorToken(value: number | string | null | undefined): string {
  const score = toScore(value);
  if (score >= 7) return 'green.400';
  if (score >= 4) return 'orange.400';
  return 'ember.500';
}

export function scoreVerdict(value: number | string | null | undefined): string {
  const score = toScore(value);
  if (score >= 9) return 'Semma! Mass code 🔥';
  if (score >= 7) return 'Nalla irukku, konjam polish pannu';
  if (score >= 4) return 'Paravaala, but work irukku';
  return 'Machaan… full rework venum';
}

export const CATEGORY_LABELS: Record<keyof CategoryScores, string> = {
  code_quality: 'Code Quality',
  structure: 'Structure',
  readability: 'Readability',
  documentation: 'Documentation',
  testing: 'Testing',
  best_practices: 'Best Practices',
};

export const CATEGORY_ORDER: (keyof CategoryScores)[] = [
  'code_quality',
  'structure',
  'readability',
  'documentation',
  'testing',
  'best_practices',
];

export const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Stable sort: high → medium → low. */
export function sortBySeverity(improvements: Improvement[]): Improvement[] {
  return improvements
    .map((item, index) => ({ item, index }))
    .sort((a, b) => SEVERITY_RANK[a.item.severity] - SEVERITY_RANK[b.item.severity] || a.index - b.index)
    .map(({ item }) => item);
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  queued: 'Queued',
  fetching: 'Fetching',
  analyzing: 'Analyzing',
  completed: 'Roasted',
  failed: 'Failed',
};

export const STATUS_COLOR_SCHEMES: Record<SubmissionStatus, string> = {
  queued: 'gray',
  fetching: 'blue',
  analyzing: 'purple',
  completed: 'green',
  failed: 'red',
};

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
];

/** "3 hours ago", "yesterday", "just now". */
export function formatRelativeDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  for (const [unit, seconds] of UNITS) {
    if (Math.abs(diffSeconds) >= seconds) {
      return rtf.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return 'just now';
}

export function isQuotaExhausted(quota: Quota | undefined): boolean {
  return Boolean(quota && quota.used >= quota.limit);
}
