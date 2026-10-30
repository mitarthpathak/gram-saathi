import { readFileSync } from 'node:fs';
import type { DialectInfo } from '@gram-saathi/shared';
import { z } from 'zod';
import { PATHS } from '../../config/env';
import { languageCodeSchema } from '../../lib/validation';

/** These classifier labels describe standard language or uncertainty, not registry dialects. */
export const STANDARD_DIALECT_LABELS = [
  'hindi',
  'marathi',
  'tamil',
  'english',
  'gujarati',
  'punjabi',
  'other_language',
  'mixed_or_uncertain',
] as const;

const dialectEntrySchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().min(1),
  nativeName: z.string().min(1),
  nativeNameVerify: z.literal(true).optional(),
  parentLanguage: languageCodeSchema,
  states: z.array(z.string().min(1)),
  suggestedDistricts: z.array(z.string().min(1)),
  confusableWith: z.array(z.string().min(1)),
  testStatus: z.enum(['experimental', 'tested']),
});

export type DialectRegistryEntry = z.infer<typeof dialectEntrySchema>;

/** Parse the full registry and ensure every cross-reference points to a known classifier label. */
export function validateDialectRegistry(input: unknown): DialectRegistryEntry[] {
  const parsed = z.array(dialectEntrySchema).parse(input);
  const ids = new Set<string>();
  for (const entry of parsed) {
    if (ids.has(entry.id)) throw new Error(`Duplicate dialect id "${entry.id}"`);
    ids.add(entry.id);
  }

  const validLabels = new Set([...ids, ...STANDARD_DIALECT_LABELS]);
  for (const entry of parsed) {
    const unknown = entry.confusableWith.filter((id) => !validLabels.has(id));
    if (unknown.length > 0) {
      throw new Error(
        `Dialect "${entry.id}" has unknown confusableWith id(s): ${unknown.join(', ')}`,
      );
    }
  }
  return parsed;
}

let registry: DialectRegistryEntry[] | undefined;

export function loadDialectRegistry(filePath: string = PATHS.dialects): DialectRegistryEntry[] {
  return validateDialectRegistry(JSON.parse(readFileSync(filePath, 'utf8')));
}

/** The validated registry, loaded on first use. */
export function getDialectRegistry(): DialectRegistryEntry[] {
  registry ??= loadDialectRegistry();
  return registry;
}

export function getDialectEntry(id: string): DialectRegistryEntry | undefined {
  return getDialectRegistry().find((entry) => entry.id === id);
}

export function isDialectId(id: string): boolean {
  return getDialectEntry(id) !== undefined;
}

/** Public option/info fields only; internal districts and confusion hypotheses stay server-side. */
export function toDialectInfo(entry: DialectRegistryEntry): DialectInfo {
  return {
    id: entry.id,
    name: entry.name,
    nativeName: entry.nativeName,
    parentLanguage: entry.parentLanguage,
    states: [...entry.states],
    testStatus: entry.testStatus,
  };
}
