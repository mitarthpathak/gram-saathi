import type { LanguageCode, QueryResponse, Source } from '@gram-saathi/shared';
import { env, isMocked } from '../../config/env';
import { LruCache } from '../../lib/cache';
import { generateJson } from '../../lib/geminiClient';
import { logger } from '../../lib/logger';
import { mockGenerateAnswer } from '../../mocks';
import { ANSWER_SYSTEM_PROMPT, answerSchema, buildAnswerInput } from '../rag/prompts';
import { searchSchemes } from '../rag/service';
import type { ScoredChunk } from '../rag/vectorStore';
import { compressForSms, countSmsSegments, truncateAtSentence } from '../sms/service';
import { detectTextLanguage } from './language';
import { getFraudWarning, MESSAGES } from './messages';

export interface AnswerInput {
  text: string;
  /** Hint from the client's language selector. */
  language?: LanguageCode;
  /** Language already known from speech recognition; skips text-based detection. */
  detectedLanguage?: LanguageCode;
  sessionId: string;
  /** Set when `text` came from speech-to-text. */
  transcript?: string;
}

/** The part of a response that depends only on the question, so it can be cached and shared. */
export type CachedAnswer = Omit<QueryResponse, 'sessionId' | 'transcript' | 'usedCache'>;

const answerCache = new LruCache<CachedAnswer>({
  maxEntries: env.CACHE_MAX_ENTRIES,
  ttlMs: env.CACHE_TTL_MINUTES * 60_000,
});
/** Identical questions that arrive at the same time share one pipeline run. */
const inFlight = new Map<string, Promise<CachedAnswer>>();

/**
 * The answer pipeline shared by text and voice queries:
 * language -> cache -> retrieve -> relevance gate -> grounded answer -> SMS + fraud warning.
 */
export async function answerQuestion(input: AnswerInput): Promise<QueryResponse> {
  const language = input.detectedLanguage ?? detectTextLanguage(input.text, input.language);
  const key = cacheKey(input.text, language);

  const cached = answerCache.get(key);
  if (cached) return toResponse(cached, input, true);

  let pending = inFlight.get(key);
  if (!pending) {
    pending = buildAnswer(input.text, language)
      .then((answer) => {
        answerCache.set(key, answer);
        return answer;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return toResponse(await pending, input, false);
}

async function buildAnswer(question: string, language: LanguageCode): Promise<CachedAnswer> {
  const retrieved = await searchSchemes({ query: question, language });
  const relevant = retrieved.filter((chunk) => chunk.score >= env.RAG_MIN_SCORE);
  if (relevant.length === 0) {
    logger.debug(
      `not found: best score ${retrieved[0]?.score.toFixed(3) ?? '-'} < RAG_MIN_SCORE ${env.RAG_MIN_SCORE}`,
    );
    return notFoundAnswer(language);
  }

  if (isMocked('chat')) {
    const mock = mockGenerateAnswer(relevant, language);
    if (mock.notFound) return notFoundAnswer(language);
    return foundAnswer(language, mock.answer, relevant, mock.smsText);
  }

  const result = await generateJson({
    label: 'answer',
    system: ANSWER_SYSTEM_PROMPT,
    input: buildAnswerInput(question, language, relevant),
    schema: answerSchema(relevant.map((chunk) => chunk.chunkId)),
  });
  const answer = toPlainText(result.answer);
  const used = relevant.filter((chunk) => result.usedChunkIds.includes(chunk.chunkId));
  // No passage used: the model found the documents do not answer it. Say so in reviewed words.
  if (used.length === 0 || !answer) return notFoundAnswer(language);

  const { sms } = await compressForSms({ text: answer, language });
  return foundAnswer(language, answer, used, sms);
}

function foundAnswer(
  language: LanguageCode,
  answer: string,
  chunks: ScoredChunk[],
  smsText: string,
): CachedAnswer {
  return {
    detectedLanguage: language,
    answer,
    sources: chunks.map(toSource),
    fraudWarning: getFraudWarning(language),
    smsText,
    smsSegments: countSmsSegments(smsText),
    // TODO(step-3) (optional): server TTS (modules/tts); null tells the client to use browser speech.
    audioUrl: null,
    notFound: false,
  };
}

/** Honest fixed answer, no model call: we do not know, confirm at the CSC / gram panchayat. */
function notFoundAnswer(language: LanguageCode): CachedAnswer {
  const smsText = truncateAtSentence(MESSAGES[language].notFoundSms, env.SMS_MAX_SEGMENTS);
  return {
    detectedLanguage: language,
    answer: MESSAGES[language].notFound,
    sources: [],
    fraudWarning: getFraudWarning(language),
    smsText,
    smsSegments: countSmsSegments(smsText),
    audioUrl: null,
    notFound: true,
  };
}

function toResponse(answer: CachedAnswer, input: AnswerInput, usedCache: boolean): QueryResponse {
  return { sessionId: input.sessionId, transcript: input.transcript, ...answer, usedCache };
}

function toSource(chunk: ScoredChunk): Source {
  return {
    schemeId: chunk.schemeId,
    schemeName: chunk.schemeName,
    section: chunk.section,
    snippet: excerpt(toPlainText(chunk.text)),
  };
}

/** Puts a ready answer in the cache, e.g. the pre-generated FAQ answers. */
export function seedAnswerCache(
  question: string,
  language: LanguageCode,
  answer: CachedAnswer,
): void {
  answerCache.set(cacheKey(question, language), answer);
}

export function clearAnswerCache(): void {
  answerCache.clear();
}

/** Language + the question without case, punctuation (incl. the Devanagari danda) or extra spaces. */
export function cacheKey(question: string, language: LanguageCode): string {
  const normalized = question
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s?!.,;:'"‘’“”।॥-]+/g, ' ')
    .trim();
  return `${language}:${normalized}`;
}

/** Markdown (lists, bold, links, hard-wrapped lines) -> one line of plain text. */
export function toPlainText(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
        .replace(/^#+\s*/, '')
        .replace(/\*\*|__|`/g, ''),
    )
    .join(' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Opening of `text`, at most `maxChars` long: whole sentences if possible, else whole words. */
export function excerpt(text: string, maxChars = 300): string {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, maxChars);
  const sentenceEnd = Math.max(...['. ', '। ', '? ', '! '].map((mark) => head.lastIndexOf(mark)));
  if (sentenceEnd >= maxChars / 2) return head.slice(0, sentenceEnd + 1);
  const wordEnd = head.lastIndexOf(' ');
  return `${head.slice(0, wordEnd > 0 ? wordEnd : maxChars).trimEnd()}…`;
}
