import type { DialectResult, LanguageCode } from '@gram-saathi/shared';
import { toSupportedLanguage } from '../../lib/languages';
import type { DialectOutcome } from './classifier';
import { getDialectEntry } from './registry';

export function parentLanguageForDialect(id: string): LanguageCode | undefined {
  return getDialectEntry(id)?.parentLanguage;
}

/** A confirmed user choice bypasses classification and is always marked high confidence. */
export function dialectHintOutcome(id: string): DialectOutcome | undefined {
  const entry = getDialectEntry(id);
  if (!entry) return undefined;
  const dialect: DialectResult = {
    id: entry.id,
    name: entry.name,
    nativeName: entry.nativeName,
    confidence: 'high',
  };
  return { dialect, dialectCandidates: [] };
}

/** Unsupported recognition labels fall back only to the selected answer language or Hindi. */
export function answerLanguageFromTranscription(
  detectedLanguage: string,
  languageHint?: LanguageCode,
  dialectHint?: string,
): LanguageCode {
  if (dialectHint) {
    const parent = parentLanguageForDialect(dialectHint);
    if (parent) return parent;
  }
  return toSupportedLanguage(detectedLanguage, languageHint ?? 'hi');
}
