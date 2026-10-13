// API contract types — keep in sync with backend Pydantic schemas (see CLAUDE.md).

export type SubmissionStatus = 'queued' | 'fetching' | 'analyzing' | 'completed' | 'failed';

export type Severity = 'low' | 'medium' | 'high';

export interface CategoryScores {
  code_quality: number;
  structure: number;
  readability: number;
  documentation: number;
  testing: number;
  best_practices: number;
}

export interface Improvement {
  file: string;
  line_hint: string | null;
  issue: string;
  suggestion: string;
  severity: Severity;
}

export interface Roast {
  id: number;
  overall_score: number;
  category_scores: CategoryScores;
  headline: string;
  roast_text: string;
  strengths: string[];
  improvements: Improvement[];
  model_used: string;
  created_at: string;
}

/** Backend `error_code` values a failed submission (or a rejected request) can carry. */
export type SubmissionErrorCode =
  | 'invalid_repo_url'
  | 'invalid_branch'
  | 'repo_not_found_or_private'
  | 'branch_not_found'
  | 'github_rate_limited'
  | 'github_unavailable'
  | 'repo_too_large'
  | 'repo_empty'
  | 'repo_unreadable'
  | 'ai_invalid_output'
  | 'ai_unavailable'
  | 'daily_limit_reached'
  | 'rate_limited'
  | 'already_processing'
  | 'internal_error';

export interface Submission {
  id: number;
  repo_url: string;
  repo_owner: string;
  repo_name: string;
  branch: string | null;
  commit_sha: string | null;
  assignment_title: string | null;
  assignment_description: string | null;
  primary_language: string | null;
  files_analyzed: number;
  status: SubmissionStatus;
  error_code: string | null;
  error_message: string | null;
  latest_roast: Roast | null;
  created_at: string;
  completed_at: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
}

export interface UpdateProfileRequest {
  full_name?: string;
  avatar_url?: string;
}

export interface SubmissionCreate {
  repo_url: string;
  branch?: string;
  assignment_title?: string;
  assignment_description?: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  avatar_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_admin: boolean;
  oauth_provider: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
}

export interface ApiError {
  detail: string;
  error_code?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface Quota {
  used: number;
  limit: number;
  resets_at: string;
}

// --- Admin -------------------------------------------------------------------

export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  is_admin: boolean;
  oauth_provider: string | null;
  submission_count: number;
  created_at: string;
}

export interface AdminUserUpdate {
  is_active?: boolean;
  is_admin?: boolean;
}

export interface AdminSubmission {
  id: number;
  user_id: number;
  user_email: string;
  repo_url: string;
  repo_owner: string;
  repo_name: string;
  status: SubmissionStatus;
  error_code: string | null;
  overall_score: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface DailyRoastCount {
  day: string;
  count: number;
}

export interface AdminStats {
  total_users: number;
  active_users: number;
  total_submissions: number;
  submissions_by_status: Record<SubmissionStatus, number>;
  failure_rate: number;
  total_roasts: number;
  roasts_today: number;
  roasts_per_day: DailyRoastCount[];
  average_score: number | null;
  total_input_tokens: number;
  total_output_tokens: number;
}
