import type { LanguageCode } from '@gram-saathi/shared';

export interface LanguageInfo {
  /** English name, used in prompts. */
  name: string;
  /** Script answers must be written in, used in prompts. */
  script: string;
}

/**
 * Every language the API answers in. To add one: add its code to `LanguageCode` in
 * shared/src/types.ts (a contract change), then add it here; the compiler then lists every
 * other place that needs text for it (fraud warning, not-found answer, eligibility text...).
 */
export const LANGUAGES: Record<LanguageCode, LanguageInfo> = {
  hi: { name: 'Hindi', script: 'Devanagari' },
  mr: { name: 'Marathi', script: 'Devanagari' },
  ta: { name: 'Tamil', script: 'Tamil' },
  en: { name: 'English', script: 'Latin' },
};

export const LANGUAGE_CODES = Object.keys(LANGUAGES) as LanguageCode[];

export function isLanguageCode(value: string): value is LanguageCode {
  return Object.hasOwn(LANGUAGES, value);
}

/** "Hindi (Devanagari script)", for prompts. */
export function describeLanguage(code: LanguageCode): string {
  const { name, script } = LANGUAGES[code];
  return `${name} (${script} script)`;
}

/** Dialects and other spellings mapped to the language we answer in. */
const ALIASES: Record<string, LanguageCode> = {
  hin: 'hi',
  hindi: 'hi',
  hinglish: 'hi',
  bho: 'hi', // Bhojpuri
  bhojpuri: 'hi',
  awa: 'hi', // Awadhi
  awadhi: 'hi',
  mai: 'hi', // Maithili
  maithili: 'hi',
  mag: 'hi', // Magahi
  bra: 'hi', // Braj
  bgc: 'hi', // Haryanvi
  raj: 'hi', // Rajasthani
  hne: 'hi', // Chhattisgarhi
  bns: 'hi', // Bundeli
  bundeli: 'hi',
  braj: 'hi',
  wagdi: 'hi',
  marwari: 'hi',
  dhundhari: 'hi',
  shekhawati: 'hi',
  bagri: 'hi',
  mewari: 'hi',
  mewati: 'hi',
  harauti: 'hi',
  malvi: 'hi',
  haryanvi: 'hi',
  mar: 'mr',
  marathi: 'mr',
  vah: 'mr', // Varhadi
  varhadi: 'mr',
  tam: 'ta',
  tamil: 'ta',
  eng: 'en',
  english: 'en',
};

/**
 * Maps a detected language (e.g. "hi-IN", "Bhojpuri", "bho") to one we can answer in.
 * Languages we do not support yet fall back to `fallback`.
 */
export function toSupportedLanguage(detected: string, fallback: LanguageCode): LanguageCode {
  const value = detected.trim().toLowerCase();
  const base = value.split(/[-_\s]/)[0];
  if (isLanguageCode(base)) return base;
  return ALIASES[value] ?? ALIASES[base] ?? fallback;
}
