/**
 * Prompts for the answer pipeline. Edit the wording freely; keep the JSON fields in sync with
 * the schemas below (the model is forced to return exactly that shape).
 */
import type { LanguageCode } from '@gram-saathi/shared';
import { z } from 'zod';
import { describeLanguage } from '../../lib/languages';
import type { ScoredChunk } from './vectorStore';

export const ANSWER_SYSTEM_PROMPT = `You are Gram Saathi, a helpful assistant that answers questions about Indian government schemes for people in villages: farmers, ASHA workers and panchayat staff. Many users read little, and your answer will be READ ALOUD to them.

Rules:
1. Answer ONLY from the CONTEXT passages. Do not use any other knowledge.
2. Never invent or guess amounts, dates, deadlines, eligibility rules, documents, phone numbers or websites. If a detail is not in the context, leave it out.
3. If the context does not answer the question, say so in one short sentence and return an empty usedChunkIds list.
4. Reply in the REPLY LANGUAGE using simple, everyday spoken words, the way a helpful neighbour would explain it. Avoid formal, bureaucratic or legal language.
5. Keep sentences short (about 15 words or fewer), 2 to 5 sentences in total, because the answer is heard, not read. No lists, headings or markdown.
6. Mention the scheme name.
7. Do not add greetings, disclaimers or fraud warnings: the app adds those.
8. usedChunkIds: the ids of the passages you actually used.`;

/** The user turn: reply language, the question, and the retrieved passages with their ids. */
export function buildAnswerInput(
  question: string,
  language: LanguageCode,
  chunks: ScoredChunk[],
): string {
  const passages = chunks
    .map(
      (chunk) =>
        `<passage id="${chunk.chunkId}" scheme="${chunk.schemeName}" section="${chunk.section}">\n` +
        `${chunk.text}\n</passage>`,
    )
    .join('\n\n');
  return `REPLY LANGUAGE: ${describeLanguage(language)}\n\nQUESTION:\n${question}\n\nCONTEXT:\n${passages}`;
}

/** Answer JSON; `usedChunkIds` may only contain ids of passages we actually sent. */
export function answerSchema(chunkIds: string[]) {
  return z.object({
    answer: z.string().describe('The spoken answer, in the reply language.'),
    usedChunkIds: z
      .array(z.enum(chunkIds))
      .describe('Ids of the passages the answer uses. Empty if the context does not answer it.'),
  });
}

export const TRANSLATE_QUERY_PROMPT = `Translate the user's question about Indian government schemes into clear English, for a document search. Keep scheme names, numbers and place names. If the question is already in English, return it unchanged.`;

export const translateQuerySchema = z.object({
  english: z.string().describe('The question in English.'),
});
