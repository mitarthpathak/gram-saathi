import type { LanguageCode } from '@gram-saathi/shared';
import { z } from 'zod';

// shared/ is types-only, so the runtime list of language codes lives here. Typing it as a
// Record<LanguageCode, ...> makes the build fail if the contract gains a code we forgot.
const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  hi: 'Hindi',
  mr: 'Marathi',
  ta: 'Tamil',
  en: 'English',
};

export const LANGUAGE_CODES = Object.keys(LANGUAGE_NAMES) as LanguageCode[];

export const languageCodeSchema = z.enum(LANGUAGE_CODES);

export const sessionIdSchema = z.string().trim().min(1).max(100);

/** Multipart text fields arrive as strings: treat an empty field like a missing one. */
export function optionalFormField<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}
