/** Mirrors the backend GitHub URL regex (keep in sync with backend validation). */
export const GITHUB_REPO_URL_REGEX =
  /^https:\/\/github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})(?:\.git)?(?:\/tree\/([^\s?#]+))?\/?$/;

export interface ParsedRepoUrl {
  owner: string;
  repo: string;
  branch: string | null;
}

/** Parse a public GitHub repo URL. Returns null when it doesn't match. */
export function parseRepoUrl(url: string): ParsedRepoUrl | null {
  const match = GITHUB_REPO_URL_REGEX.exec(url.trim());
  if (!match) return null;
  const [, owner, rawRepo, branch] = match;
  if (!owner || !rawRepo) return null;
  // The regex's repo group is greedy over '.', so strip a trailing .git explicitly.
  const repo = rawRepo.endsWith('.git') ? rawRepo.slice(0, -4) : rawRepo;
  if (!repo) return null;
  return { owner, repo, branch: branch ? branch.replace(/\/+$/, '') : null };
}

export function isValidRepoUrl(url: string): boolean {
  return parseRepoUrl(url) !== null;
}

/** Returns a friendly validation message, or null when the URL is valid. */
export function validateRepoUrl(url: string): string | null {
  const value = url.trim();
  if (!value) return 'Paste a GitHub repo URL.';
  if (!value.startsWith('https://github.com/')) {
    return 'Only https://github.com/ links work (public repos only).';
  }
  if (!isValidRepoUrl(value)) {
    return 'That is not a valid repo link. Use https://github.com/owner/repo';
  }
  return null;
}
