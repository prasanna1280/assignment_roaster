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

export type ScoreColorToken = 'severity.low' | 'severity.medium' | 'severity.high';

/** Semantic colour token (light/dark aware) for a 0–10 score. */
export function scoreColorToken(value: number | string | null | undefined): ScoreColorToken {
  const score = toScore(value);
  if (score >= 7) return 'severity.low';
  if (score >= 4) return 'severity.medium';
  return 'severity.high';
}

/** Raw palette tokens behind the severity colours, for SVG attributes (which can't use CSS vars). */
export const SEVERITY_PALETTE: Record<ScoreColorToken, { light: string; dark: string }> = {
  'severity.low': { light: 'green.700', dark: 'green.300' },
  'severity.medium': { light: 'orange.600', dark: 'orange.300' },
  'severity.high': { light: 'red.600', dark: 'red.300' },
};

export function scoreVerdict(value: number | string | null | undefined): string {
  const score = toScore(value);
  if (score >= 9) return 'Excellent';
  if (score >= 7) return 'Good, needs some polish';
  if (score >= 4) return 'Fair, needs work';
  return 'Needs a major rework';
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

/** Markdown task list of fixes (high → low), ready to paste into a GitHub issue. */
export function fixesToMarkdown(improvements: Improvement[], repoName: string): string {
  const lines = sortBySeverity(improvements).map((item) => {
    const location = item.line_hint ? `\`${item.file}\` (${item.line_hint})` : `\`${item.file}\``;
    return `- [ ] **${SEVERITY_LABELS[item.severity]}** ${location}: ${item.issue.replace(/[.\s]+$/, '')}. Fix: ${item.suggestion}`;
  });
  return [`## Fixes for ${repoName}`, '', ...lines, ''].join('\n');
}
