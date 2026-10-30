import type { LanguageCode } from '@gram-saathi/shared';
import { useSettings } from './settings';

/**
 * UI text lives next to each feature (`features/<name>/strings.ts`), so workstreams never
 * edit the same translation file. Write the English object first and type the rest with
 * `Strings<typeof en>`: the build fails if a language misses a key.
 */
export type Strings<T extends Record<string, string>> = Record<LanguageCode, T>;

/** The strings for the current UI language. */
export function useStrings<T extends Record<string, string>>(strings: Strings<T>): T {
  return strings[useSettings().language];
}

/** Fills `{placeholders}`: format('Question {current} of {total}', { current: 1, total: 4 }). */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}
