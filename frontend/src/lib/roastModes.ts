import type { RoastLanguage, RoastLevel } from '../types';

export interface RoastOption<T extends string> {
  value: T;
  label: string;
  description: string;
}

export const ROAST_LEVELS: RoastOption<RoastLevel>[] = [
  { value: 'lite', label: 'Lite', description: 'Gentle mentor. Encouraging, light humour.' },
  { value: 'medium', label: 'Medium', description: 'Classic roast. Playful jokes, direct feedback.' },
  { value: 'spicy', label: 'Spicy', description: 'No mercy for the code. Still never personal.' },
];

export const ROAST_LANGUAGES: RoastOption<RoastLanguage>[] = [
  { value: 'english', label: 'English', description: 'Plain, friendly English.' },
  { value: 'tamil', label: 'Tamil', description: 'Tamil script, tech terms in English.' },
  { value: 'tanglish', label: 'Tanglish', description: 'Tamil in Latin letters, mixed with English.' },
];

export const DEFAULT_ROAST_LEVEL: RoastLevel = 'medium';
export const DEFAULT_ROAST_LANGUAGE: RoastLanguage = 'tanglish';

export function roastLevelLabel(level: RoastLevel): string {
  return ROAST_LEVELS.find((option) => option.value === level)?.label ?? level;
}

export function roastLanguageLabel(language: RoastLanguage): string {
  return ROAST_LANGUAGES.find((option) => option.value === language)?.label ?? language;
}

const PREFERENCE_KEY = 'ar_roast_mode';

export interface RoastModePreference {
  level: RoastLevel;
  language: RoastLanguage;
}

function isLevel(value: unknown): value is RoastLevel {
  return ROAST_LEVELS.some((option) => option.value === value);
}

function isLanguage(value: unknown): value is RoastLanguage {
  return ROAST_LANGUAGES.some((option) => option.value === value);
}

/** Last roast mode the user picked on this device (falls back to the defaults). */
export function loadRoastModePreference(): RoastModePreference {
  const fallback = { level: DEFAULT_ROAST_LEVEL, language: DEFAULT_ROAST_LANGUAGE };
  try {
    const raw = window.localStorage.getItem(PREFERENCE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    const { level, language } = parsed as Record<string, unknown>;
    return {
      level: isLevel(level) ? level : fallback.level,
      language: isLanguage(language) ? language : fallback.language,
    };
  } catch {
    return fallback;
  }
}

export function saveRoastModePreference(preference: RoastModePreference): void {
  try {
    window.localStorage.setItem(PREFERENCE_KEY, JSON.stringify(preference));
  } catch {
    // Storage unavailable (private mode / blocked); the choice just isn't remembered.
  }
}
