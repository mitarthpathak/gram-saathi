import { z } from 'zod';
import { LANGUAGE_CODES } from './languages';

export const languageCodeSchema = z.enum(LANGUAGE_CODES);

export const sessionIdSchema = z.string().trim().min(1).max(100);

/** Multipart text fields arrive as strings: treat an empty field like a missing one. */
export function optionalFormField<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}
