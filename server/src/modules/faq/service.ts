import { existsSync, readFileSync } from 'node:fs';
import type { FaqItem, LanguageCode } from '@gram-saathi/shared';
import { z } from 'zod';
import { isMocked, PATHS } from '../../config/env';
import { HttpError } from '../../lib/httpError';
import { languageCodeSchema } from '../../lib/validation';
import { mockTopFaq } from '../../mocks';
import { seedAnswerCache } from '../chat/service';

const sourceSchema = z.object({
  schemeId: z.string(),
  schemeName: z.string(),
  section: z.string(),
  snippet: z.string(),
});

/** A full answer without the per-request fields, as produced by the chat pipeline. */
const cachedAnswerSchema = z.object({
  detectedLanguage: languageCodeSchema,
  answer: z.string(),
  sources: z.array(sourceSchema),
  fraudWarning: z.string(),
  smsText: z.string(),
  smsSegments: z.number(),
  audioUrl: z.string().nullable(),
  notFound: z.boolean(),
});

/** Shape of server/data/faq.json (written by `npm run prewarm`). */
export const faqFileSchema = z.object({
  version: z.literal(1),
  createdAt: z.string(),
  chatModel: z.string(),
  /** The knowledge base the answers came from, to detect stale FAQs. */
  sourceFingerprint: z.string(),
  languages: z.partialRecord(
    languageCodeSchema,
    z.array(z.object({ id: z.string(), question: z.string(), answer: cachedAnswerSchema })),
  ),
});
export type FaqFile = z.infer<typeof faqFileSchema>;

let faq: FaqFile | undefined;

/**
 * Loads the pre-generated answers and puts them in the answer cache, so asking an FAQ by voice
 * or text is instant too. Undefined when the file does not exist yet.
 */
export function loadFaq(filePath: string = PATHS.faq): FaqFile | undefined {
  if (!existsSync(filePath)) return undefined;
  faq = faqFileSchema.parse(JSON.parse(readFileSync(filePath, 'utf8')));
  for (const [language, items] of Object.entries(faq.languages)) {
    for (const { question, answer } of items) {
      seedAnswerCache(question, language as LanguageCode, answer);
    }
  }
  return faq;
}

/** The most asked questions with short answers. Clients cache this for offline use. */
export async function getTopFaqs(language: LanguageCode): Promise<FaqItem[]> {
  if (isMocked('faq')) return mockTopFaq(language);
  const loaded = faq ?? loadFaq();
  if (!loaded) {
    throw new HttpError(
      503,
      'FAQ_NOT_READY',
      'No FAQ answers yet: run `npm run prewarm -w server` (server/data/faq.json).',
    );
  }
  return (loaded.languages[language] ?? []).map(({ id, question, answer }) => ({
    id,
    question,
    answer: answer.answer,
    sources: answer.sources,
  }));
}
