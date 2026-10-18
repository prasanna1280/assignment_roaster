const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Please enter your email.';
  if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address.';
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (!password) return 'Please enter your password.';
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Password max ${PASSWORD_MAX} characters dhaan.`;
  return undefined;
}

export function validateFullName(name: string): string | undefined {
  if (!name.trim()) return 'Unga peru sollunga — full name is required.';
  if (name.trim().length > 255) return 'Name is too long.';
  return undefined;
}

export function validateAvatarUrl(url: string): string | undefined {
  if (!url.trim()) return undefined;
  if (url.trim().length > 500) return 'Avatar URL max 500 characters dhaan.';
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return 'Avatar URL must start with http:// or https://.';
    }
    return undefined;
  } catch {
    return 'Enter a valid URL.';
  }
}
