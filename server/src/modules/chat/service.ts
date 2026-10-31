import type { LanguageCode, QueryResponse, Source } from '@gram-saathi/shared';
import { env, isMocked } from '../../config/env';
import { LruCache } from '../../lib/cache';
import { generateJson } from '../../lib/geminiClient';
import { logger } from '../../lib/logger';
import { mockDialectFields, mockGenerateAnswer } from '../../mocks';
import { getDialectExemplars, renderPromptExemplars } from '../dialect/exemplars';
import {
  classifyDialect,
  getActiveDialectLabels,
  type DialectOutcome,
} from '../dialect/classifier';
import { dialectHintOutcome, parentLanguageForDialect } from '../dialect/language';
import { ANSWER_SYSTEM_PROMPT, answerSchema, buildAnswerInput } from '../rag/prompts';
import { searchSchemes } from '../rag/service';
import type { ScoredChunk } from '../rag/vectorStore';
import { compressForSms, countSmsSegments, truncateAtSentence } from '../sms/service';
import {
  defaultScriptForLanguage,
  detectTextLanguage,
  detectTextScript,
  type ReplyScript,
} from './language';
import { getFraudWarning, getGreetingReply, getMessage, getSmallTalkReply } from './messages';
import { getHistory, handleTurn, recordTurn, type Passage } from './conversation';

export interface AnswerInput {
  text: string;
  /** Hint from the client's language selector. */
  language?: LanguageCode;
  /** Registry id confirmed or selected by the user. */
  dialectHint?: string;
  /** Audio evidence is supplied only by the voice route. */
  dialectEvidence?: {
    audio?: { data: string; mimeType: string };
    text?: string;
  };
  /** Language already known from speech recognition; skips text-based detection. */
  detectedLanguage?: LanguageCode;
  sessionId?: string;
  /** Set when `text` came from speech-to-text. */
  transcript?: string;
}

/** The part of a response that depends only on the question, so it can be cached and shared. */
export type CachedAnswer = Omit<
  QueryResponse,
  'sessionId' | 'transcript' | 'usedCache' | 'dialect' | 'dialectCandidates'
>;

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
  const language =
    (input.dialectHint ? parentLanguageForDialect(input.dialectHint) : undefined) ??
    input.detectedLanguage ??
    detectTextLanguage(input.text, input.language);
  const script = detectTextScript(input.text) ?? defaultScriptForLanguage(language);

  const greeting = isMocked('chat') ? getGreetingReply(input.text, language, script) : undefined;
  if (greeting) {
    const dialect = input.dialectHint
      ? (dialectHintOutcome(input.dialectHint) ?? { dialect: null, dialectCandidates: [] })
      : { dialect: null, dialectCandidates: [] };
    return {
      sessionId: input.sessionId ?? '',
      transcript: input.transcript,
      ...dialect,
      detectedLanguage: language,
      answer: greeting.answer,
      sources: [],
      fraudWarning: getFraudWarning(language, script),
      smsText: greeting.smsText,
      smsSegments: countSmsSegments(greeting.smsText),
      audioUrl: null,
      usedCache: false,
      notFound: false,
    };
  }

  const smallTalk = isMocked('chat') ? getSmallTalkReply(input.text, language, script) : undefined;
  if (smallTalk) {
    const dialect = input.dialectHint
      ? (dialectHintOutcome(input.dialectHint) ?? { dialect: null, dialectCandidates: [] })
      : { dialect: null, dialectCandidates: [] };
    return {
      sessionId: input.sessionId ?? '',
      transcript: input.transcript,
      ...dialect,
      detectedLanguage: language,
      answer: smallTalk.answer,
      sources: [],
      fraudWarning: getFraudWarning(language, script),
      smsText: smallTalk.smsText,
      smsSegments: countSmsSegments(smallTalk.smsText),
      audioUrl: null,
      usedCache: false,
      notFound: false,
    };
  }

  const dialect = await getDialectOutcome(input);
  const dialectId = input.dialectHint ?? dialect.dialect?.id;

  // Preserve the pre-existing mocked answer pipeline byte-for-byte in USE_MOCKS mode.
  if (!isMocked('chat')) {
    return answerConversation(input, language, dialect, dialectId);
  }

  const key = cacheKey(input.text, language, dialectId, script);

  const cached = answerCache.get(key);
  if (cached) {
    return { ...toResponse(cached, input, true), ...dialect };
  }

  let pending = inFlight.get(key);
  if (!pending) {
    pending = buildAnswer(input.text, language, dialectId, script)
      .then((answer) => {
        answerCache.set(key, answer);
        return answer;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  const answer = await pending;
  return { ...toResponse(answer, input, false), ...dialect };
}

async function answerConversation(
  input: AnswerInput,
  fallbackLanguage: LanguageCode,
  dialect: DialectOutcome,
  dialectId?: string,
): Promise<QueryResponse> {
  let retrieved: ScoredChunk[] = [];
  const result = await handleTurn(
    {
      minScore: env.RAG_MIN_SCORE,
      generateJson: ({ system, prompt, schema }) =>
        generateJson({ label: 'conversation', system, input: prompt, schema }),
      search: async (queryEn) => {
        retrieved = await searchSchemes({ query: queryEn, language: 'en', skipTranslation: true });
        return retrieved.map((chunk): Passage => ({
          id: chunk.chunkId,
          schemeName: chunk.schemeName,
          section: chunk.section,
          text: chunk.text,
          score: chunk.score,
        }));
      },
      dialectExamples: (label) =>
        renderPromptExemplars([label], getDialectExemplars()),
    },
    {
      text: input.text,
      history: input.sessionId ? getHistory(input.sessionId) : [],
      dialectHint: input.dialectHint ?? dialectId,
      languageHint: input.detectedLanguage ?? input.language ?? fallbackLanguage,
    },
  );

  let response: QueryResponse;
  if (result.kind === 'direct') {
    const smsText = truncateAtSentence(result.answer, env.SMS_MAX_SEGMENTS);
    response = {
      sessionId: input.sessionId ?? '',
      transcript: input.transcript,
      ...dialect,
      detectedLanguage: result.language,
      answer: result.answer,
      sources: [],
      fraudWarning: getFraudWarning(result.language),
      smsText,
      smsSegments: countSmsSegments(smsText),
      audioUrl: null,
      usedCache: false,
      notFound: false,
    };
  } else if (result.kind === 'notFound') {
    response = {
      sessionId: input.sessionId ?? '',
      transcript: input.transcript,
      ...dialect,
      ...notFoundAnswer(result.language ?? fallbackLanguage),
      usedCache: false,
    };
  } else {
    const usedChunks = retrieved.filter((chunk) => result.usedChunkIds.includes(chunk.chunkId));
    if (!result.answer || usedChunks.length === 0 || !preservesContextNumbers(result.answer, usedChunks)) {
      response = {
        sessionId: input.sessionId ?? '',
        transcript: input.transcript,
        ...dialect,
        ...notFoundAnswer(result.language),
        usedCache: false,
      };
    } else {
      const { sms } = await compressForSms({ text: result.answer, language: result.language });
      response = {
        sessionId: input.sessionId ?? '',
        transcript: input.transcript,
        ...dialect,
        ...foundAnswer(result.language, result.answer, usedChunks, sms),
        usedCache: false,
      };
    }
  }
  if (input.sessionId) recordTurn(input.sessionId, input.text, response.answer);
  return response;
}

async function getDialectOutcome(input: AnswerInput): Promise<DialectOutcome> {
  if (input.dialectHint) {
    return dialectHintOutcome(input.dialectHint) ?? { dialect: null, dialectCandidates: [] };
  }

  const audio = input.dialectEvidence?.audio;
  const isVoice = Boolean(audio);
  if (!isVoice && !env.DIALECT_TEXT_DETECT) {
    return { dialect: null, dialectCandidates: [] };
  }
  if (isMocked('dialect')) return conservativeDialectOutcome(mockDialectFields());

  try {
    const outcome = await classifyDialect({
      audio,
      text: isVoice ? (input.dialectEvidence?.text ?? input.text) : input.text,
      activeLabels: getActiveDialectLabels(),
    });
    return conservativeDialectOutcome(outcome);
  } catch {
    logger.warn('dialect classifier unavailable; returning an abstention');
    return { dialect: null, dialectCandidates: [] };
  }
}

/** Only repo-classified high confidence survives as a prompt hint; medium and abstentions are omitted. */
function conservativeDialectOutcome(outcome: DialectOutcome): DialectOutcome {
  if (outcome.dialect?.confidence !== 'medium') return outcome;
  return { dialect: null, dialectCandidates: outcome.dialectCandidates ?? [] };
}

async function buildAnswer(
  question: string,
  language: LanguageCode,
  dialectId?: string,
  script?: ReplyScript,
): Promise<CachedAnswer> {
  const retrieved = await searchSchemes({ query: question, language });
  const relevant = retrieved.filter((chunk) => chunk.score >= env.RAG_MIN_SCORE);
  if (relevant.length === 0) {
    logger.debug(
      `not found: best score ${retrieved[0]?.score.toFixed(3) ?? '-'} < RAG_MIN_SCORE ${env.RAG_MIN_SCORE}`,
    );
    return notFoundAnswer(language, script);
  }

  if (isMocked('chat')) {
    const mock = mockGenerateAnswer(relevant, language, script === 'Latin' ? 'roman' : 'native');
    if (mock.notFound) return notFoundAnswer(language, script);
    return foundAnswer(language, mock.answer, relevant, mock.smsText, script);
  }

  const result = await generateJson({
    label: 'answer',
    system: ANSWER_SYSTEM_PROMPT,
    input: buildAnswerInput(question, language, relevant, dialectId, script),
    schema: answerSchema(relevant.map((chunk) => chunk.chunkId)),
  });
  const answer = toPlainText(result.answer);
  const used = relevant.filter((chunk) => result.usedChunkIds.includes(chunk.chunkId));
  // No passage used: the model found the documents do not answer it. Say so in reviewed words.
  if (used.length === 0 || !answer || !preservesContextNumbers(answer, used)) {
    return notFoundAnswer(language, script);
  }

  const { sms } = await compressForSms({ text: answer, language }, script);
  return foundAnswer(language, answer, used, sms, script);
}

function foundAnswer(
  language: LanguageCode,
  answer: string,
  chunks: ScoredChunk[],
  smsText: string,
  script?: ReplyScript,
): CachedAnswer {
  return {
    detectedLanguage: language,
    answer,
    sources: chunks.map(toSource),
    fraudWarning: getFraudWarning(language, script),
    smsText,
    smsSegments: countSmsSegments(smsText),
    // TODO(step-3) (optional): server TTS (modules/tts); null tells the client to use browser speech.
    audioUrl: null,
    notFound: false,
  };
}

/** Honest fixed answer, no model call: we do not know, confirm at the CSC / gram panchayat. */
function notFoundAnswer(language: LanguageCode, script?: ReplyScript): CachedAnswer {
  const smsText = truncateAtSentence(
    getMessage(language, 'notFoundSms', script),
    env.SMS_MAX_SEGMENTS,
  );
  return {
    detectedLanguage: language,
    answer: getMessage(language, 'notFound', script),
    sources: [],
    fraudWarning: getFraudWarning(language, script),
    smsText,
    smsSegments: countSmsSegments(smsText),
    audioUrl: null,
    notFound: true,
  };
}

function toResponse(answer: CachedAnswer, input: AnswerInput, usedCache: boolean): QueryResponse {
  return {
    sessionId: input.sessionId ?? '',
    transcript: input.transcript,
    ...answer,
    usedCache,
  };
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
  answerCache.set(
    cacheKey(question, language, undefined, defaultScriptForLanguage(language)),
    answer,
  );
}

export function clearAnswerCache(): void {
  answerCache.clear();
}

/** Language + the question without case, punctuation (incl. the Devanagari danda) or extra spaces. */
export function cacheKey(
  question: string,
  language: LanguageCode,
  dialectId?: string,
  script?: ReplyScript,
): string {
  const normalized = question
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s?!.,;:'"‘’“”।॥-]+/g, ' ')
    .trim();
  const scriptPart = script ? `${script}:` : '';
  return dialectId
    ? `${language}:${scriptPart}${dialectId}:${normalized}`
    : `${language}:${scriptPart}${normalized}`;
}

/** Rejects numeric claims that are absent from the cited official passages. */
function preservesContextNumbers(answer: string, chunks: ScoredChunk[]): boolean {
  const supported = new Set(
    chunks.flatMap((chunk) => numericLiterals(chunk.text).map(normalizeNumericLiteral)),
  );
  return numericLiterals(answer).every((value) => supported.has(normalizeNumericLiteral(value)));
}

function numericLiterals(text: string): string[] {
  return text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
}

function normalizeNumericLiteral(value: string): string {
  return value.replace(/,/g, '');
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
