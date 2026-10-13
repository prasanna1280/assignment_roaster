import type { Roast, Submission } from '../../types';

export const mockRoast: Roast = {
  id: 11,
  overall_score: 7.5,
  category_scores: {
    code_quality: 8,
    structure: 7,
    readability: 6.5,
    documentation: 3,
    testing: 2,
    best_practices: 9,
  },
  headline: 'Machaan, code nalla irukku but tests enga?',
  roast_text: '## Overview\n\nOru function la **300 lines** ah? Idhu function illa, full novel da!',
  strengths: ['Clean folder structure', 'Good use of type hints'],
  improvements: [
    { file: 'README.md', line_hint: null, issue: 'README is just TODO', suggestion: 'Write setup steps', severity: 'low' },
    { file: 'app/main.py', line_hint: 'L10-L40', issue: 'Hardcoded secret key', suggestion: 'Use env vars', severity: 'high' },
    { file: 'app/utils.py', line_hint: 'L5', issue: 'Huge function', suggestion: 'Split it up', severity: 'medium' },
  ],
  model_used: 'test-model',
  created_at: '2026-10-10T10:00:00Z',
};

export function makeSubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: 42,
    repo_url: 'https://github.com/kavya/todo-api',
    repo_owner: 'kavya',
    repo_name: 'todo-api',
    branch: null,
    commit_sha: 'abc123',
    assignment_title: 'Week 3 Todo API',
    assignment_description: null,
    primary_language: 'Python',
    files_analyzed: 12,
    status: 'completed',
    error_code: null,
    error_message: null,
    latest_roast: mockRoast,
    created_at: '2026-10-10T09:59:00Z',
    completed_at: '2026-10-10T10:00:00Z',
    ...overrides,
  };
}
