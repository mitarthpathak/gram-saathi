import type { LanguageCode, SmsCompressRequest, SmsCompressResponse } from '@gram-saathi/shared';
import { env, isMocked } from '../../config/env';
import { generateJson } from '../../lib/geminiClient';
import { logger } from '../../lib/logger';
import { buildSmsInput, SMS_SYSTEM_PROMPT, smsSchema } from './prompts';

/**
 * SMS version of `text` in at most SMS_MAX_SEGMENTS segments. Gemini rewrites it under a strict
 * character budget; if that fails or is still too long, a deterministic cut at a sentence
 * boundary is used, so this never fails because of the AI.
 */
export async function compressForSms({
  text,
  language,
}: SmsCompressRequest): Promise<SmsCompressResponse> {
  const maxSegments = env.SMS_MAX_SEGMENTS;
  const clean = prepareForSms(text, language);
  if (countSmsSegments(clean) <= maxSegments) return withSegments(clean);

  if (!isMocked('sms')) {
    try {
      // Ask for ~90% of the real budget: models count characters loosely.
      const budget = Math.floor(smsCharBudget(language, maxSegments) * 0.9);
      const { sms } = await generateJson({
        label: 'sms',
        system: SMS_SYSTEM_PROMPT,
        input: buildSmsInput(clean, language, budget),
        schema: smsSchema,
        maxOutputTokens: 1024,
      });
      const candidate = prepareForSms(sms, language);
      if (candidate) return withSegments(truncateAtSentence(candidate, maxSegments));
    } catch (error) {
      logger.warn(`SMS compression with Gemini failed, using the fallback: ${String(error)}`);
    }
  }
  return withSegments(truncateAtSentence(clean, maxSegments));
}

function withSegments(sms: string): SmsCompressResponse {
  return { sms, segments: countSmsSegments(sms) };
}

/** Characters that fit in `segments` SMS: English is sent as GSM-7, Indic scripts as Unicode. */
export function smsCharBudget(language: LanguageCode, segments: number): number {
  if (language === 'en') return segments === 1 ? 160 : 153 * segments;
  return segments === 1 ? 70 : 67 * segments;
}

// Typographic characters outside GSM-7 that would turn an English SMS into Unicode.
const GSM_REPLACEMENTS: [RegExp, string][] = [
  [/₹\s?/g, 'Rs '],
  [/[‘’‛′]/g, "'"],
  [/[“”„″]/g, '"'],
  [/[–—‒−]/g, '-'],
  [/…/g, '...'],
];

/** One line, single spaces; for English also GSM-7-safe punctuation and "Rs" for "₹". */
export function prepareForSms(text: string, language: LanguageCode): string {
  let result = text;
  if (language === 'en') {
    for (const [pattern, replacement] of GSM_REPLACEMENTS)
      result = result.replace(pattern, replacement);
  }
  return result.replace(/\s+/g, ' ').trim();
}

// GSM 03.38 alphabet: basic characters cost 1 unit, extension-table characters cost 2.
const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXTENDED = '^{}\\[~]|€\f';

/**
 * Number of SMS segments `text` needs. GSM-7 text fits 160 characters (153 per segment when
 * split); anything else is sent as UCS-2 Unicode, which fits 70 (67 per segment). Every Hindi,
 * Marathi or Tamil SMS is Unicode.
 */
export function countSmsSegments(text: string): number {
  if (text.length === 0) return 0;
  let gsmUnits = 0;
  for (const char of text) {
    if (GSM7_BASIC.includes(char)) gsmUnits += 1;
    else if (GSM7_EXTENDED.includes(char)) gsmUnits += 2;
    // UCS-2 counts UTF-16 code units, which is exactly what String#length measures.
    else return text.length <= 70 ? 1 : Math.ceil(text.length / 67);
  }
  return gsmUnits <= 160 ? 1 : Math.ceil(gsmUnits / 153);
}

/** The longest run of whole sentences that fits `maxSegments`; else a word-boundary cut. */
export function truncateAtSentence(text: string, maxSegments: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (countSmsSegments(clean) <= maxSegments) return clean;

  let kept = '';
  for (const sentence of clean.split(/(?<=[.!?।॥])\s+/u)) {
    const candidate = kept ? `${kept} ${sentence}` : sentence;
    if (countSmsSegments(candidate) > maxSegments) break;
    kept = candidate;
  }
  return kept || truncateToSegments(clean, maxSegments);
}

/** Cuts `text` at a word boundary so it fits `maxSegments`, ending with "..." (GSM-safe). */
export function truncateToSegments(text: string, maxSegments: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (countSmsSegments(clean) <= maxSegments) return clean;

  let end = clean.length;
  while (end > 0 && countSmsSegments(`${clean.slice(0, end).trimEnd()}...`) > maxSegments) {
    const lastSpace = clean.lastIndexOf(' ', end - 1);
    end = lastSpace > 0 ? lastSpace : end - 1;
  }
  return `${clean.slice(0, end).trimEnd()}...`;
}
