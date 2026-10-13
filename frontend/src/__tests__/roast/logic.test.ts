import { describe, expect, it } from 'vitest';
import { isValidRepoUrl, parseRepoUrl, validateRepoUrl } from '../../lib/repoUrl';
import { isTerminalStatus, POLL_INTERVAL_MS, submissionRefetchInterval } from '../../hooks/useSubmissions';
import { formatScore, sortBySeverity, toScore } from '../../components/roast/roastUtils';
import { getErrorTip } from '../../components/roast/errorTips';
import { makeSubmission, mockRoast } from './fixtures';

describe('repoUrl validation', () => {
  it.each([
    'https://github.com/kavya/todo-api',
    'https://github.com/kavya/todo-api/',
    'https://github.com/kavya/todo-api.git',
    'https://github.com/my-org/repo.name_v2',
    'https://github.com/kavya/todo-api/tree/feature/login',
  ])('accepts %s', (url) => {
    expect(isValidRepoUrl(url)).toBe(true);
    expect(validateRepoUrl(url)).toBeNull();
  });

  it.each([
    '',
    'http://github.com/kavya/todo-api',
    'https://gitlab.com/kavya/todo-api',
    'https://github.com/kavya',
    'https://github.com/kavya/todo-api?tab=readme',
    'https://github.com/kav_ya/todo-api',
    'https://github.com/kavya/todo api',
    'github.com/kavya/todo-api',
  ])('rejects %s', (url) => {
    expect(isValidRepoUrl(url)).toBe(false);
    expect(validateRepoUrl(url)).toEqual(expect.any(String));
  });

  it('parses owner, repo and branch', () => {
    expect(parseRepoUrl('https://github.com/kavya/todo-api')).toEqual({ owner: 'kavya', repo: 'todo-api', branch: null });
    expect(parseRepoUrl('https://github.com/kavya/todo-api.git')).toEqual({
      owner: 'kavya',
      repo: 'todo-api',
      branch: null,
    });
    expect(parseRepoUrl('https://github.com/kavya/todo-api/tree/feature/login/')).toEqual({
      owner: 'kavya',
      repo: 'todo-api',
      branch: 'feature/login',
    });
  });
});

describe('isTerminalStatus / polling', () => {
  it('treats completed and failed as terminal', () => {
    expect(isTerminalStatus('completed')).toBe(true);
    expect(isTerminalStatus('failed')).toBe(true);
    expect(isTerminalStatus('queued')).toBe(false);
    expect(isTerminalStatus('fetching')).toBe(false);
    expect(isTerminalStatus('analyzing')).toBe(false);
    expect(isTerminalStatus(undefined)).toBe(false);
  });

  it('polls every 2s only while processing', () => {
    expect(submissionRefetchInterval(makeSubmission({ status: 'analyzing', latest_roast: null }))).toBe(POLL_INTERVAL_MS);
    expect(POLL_INTERVAL_MS).toBe(2000);
    expect(submissionRefetchInterval(makeSubmission({ status: 'completed' }))).toBe(false);
    expect(submissionRefetchInterval(makeSubmission({ status: 'failed' }))).toBe(false);
    expect(submissionRefetchInterval(undefined)).toBe(false);
  });
});

describe('roast utils', () => {
  it('sorts improvements by severity, stable within a level', () => {
    const sorted = sortBySeverity(mockRoast.improvements);
    expect(sorted.map((i) => i.severity)).toEqual(['high', 'medium', 'low']);
  });

  it('coerces Decimal-as-string scores', () => {
    expect(toScore('7.5')).toBe(7.5);
    expect(toScore(12)).toBe(10);
    expect(toScore('nope')).toBe(0);
    expect(formatScore(8)).toBe('8');
    expect(formatScore(6.25)).toBe('6.3');
  });

  it('returns tailored tips per error code', () => {
    expect(getErrorTip('repo_not_found_or_private').tip).toMatch(/make the repo public/i);
    expect(getErrorTip('github_rate_limited').tip).toMatch(/few minutes/i);
    expect(getErrorTip('repo_too_large').tip).toMatch(/smaller repo/i);
    expect(getErrorTip('something_new').tip).toMatch(/try again/i);
  });
});
