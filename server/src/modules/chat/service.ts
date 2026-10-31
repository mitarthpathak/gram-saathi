import type { AnswerStyle, LanguageCode, QueryResponse, Source } from '@gram-saathi/shared';
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
import { getDialectEntry } from '../dialect/registry';
import { dialectRenderEntry } from '../dialect/renderConfig';
import { extractFacts, hasFacts, mergeFacts, missingFacts } from '../../lib/facts';
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
import { getFraudWarning, getGreetingReply, getMessage, getSmallTalkReply, ASK_AGAIN } from './messages';
import { getHistory, handleTurn, recordTurn, type Passage, type Turn } from './conversation';
import { decideReplyDialect, renderInDialect, type DialectDecision } from './dialectRender';

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
      answerStyle: mockAnswerStyle(language, input.dialectHint),
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
      answerStyle: mockAnswerStyle(language, input.dialectHint),
    };
  }

  const dialect = await getDialectOutcome(input);
  const dialectId = input.dialectHint ?? dialect.dialect?.id;
  const decision = decideReplyDialect(input.dialectHint, dialect);

  // Preserve the pre-existing mocked answer pipeline byte-for-byte in USE_MOCKS mode; it only
  // gains the additive `answerStyle` field (always the standard language: mocks never reword).
  if (!isMocked('chat')) {
    return answerConversation(input, language, dialect, decision);
  }
  const mockStyle: AnswerStyle = {
    language,
    dialectId: decision.dialectId,
    rendered: 'standard',
    reason: decision.dialectId ? 'render_off' : decision.reason,
  };

  const key = cacheKey(input.text, language, dialectId, script);

  const cached = answerCache.get(key);
  if (cached) {
    return { ...toResponse(cached, input, true), ...dialect, answerStyle: { ...mockStyle, language: cached.detectedLanguage } };
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
  return { ...toResponse(answer, input, false), ...dialect, answerStyle: { ...mockStyle, language: answer.detectedLanguage } };
}

/** Fixed reviewed texts (not found) are never reworded. */
function fixedTextStyle(language: LanguageCode, decision: DialectDecision): AnswerStyle {
  return decision.dialectId
    ? { language, dialectId: decision.dialectId, rendered: 'standard', reason: 'render_off' }
    : { language, dialectId: null, rendered: 'standard', reason: decision.reason ?? 'no_dialect' };
}

function mockAnswerStyle(language: LanguageCode, dialectHint?: string): AnswerStyle {
  return dialectHint
    ? { language, dialectId: dialectHint, rendered: 'standard', reason: 'render_off' }
    : { language, dialectId: null, rendered: 'standard', reason: 'no_dialect' };
}

/** Applies the dialect decision to one reply: rewording plus facts lock, or the standard text. */
async function styleReply(
  text: string,
  language: LanguageCode,
  decision: DialectDecision,
): Promise<{ text: string; style: AnswerStyle }> {
  const standard = (reason: AnswerStyle['reason']) => ({
    text,
    style: { language, dialectId: decision.dialectId, rendered: 'standard' as const, reason },
  });
  if (!decision.dialectId) return standard(decision.reason ?? 'no_dialect');
  const entry = getDialectEntry(decision.dialectId);
  // Rewording is not translation: a reply in another language than the dialect's parent stays as is.
  if (!entry || entry.parentLanguage !== language) return standard('render_off');

  const result = await renderInDialect(
    text,
    entry,
    {
      mode: env.DIALECT_REPLY,
      verified: dialectRenderEntry(entry.id).verified,
      exemplars: renderPromptExemplars([entry.id], getDialectExemplars()),
      timeoutMs: env.DIALECT_RENDER_TIMEOUT_MS,
    },
    {
      generateJson: ({ system, prompt, schema, timeoutMs }) =>
        generateJson({ label: 'reply-dialect', system, input: prompt, schema, timeoutMs, maxRetries: 0 }),
    },
  );
  logger.debug(
    `dialect reply ${entry.id}: ${result.rendered}${result.reason ? ` (${result.reason})` : ''}` +
      `${result.zeroShot ? ', no consented exemplars (best effort)' : ''}${result.detail ? `: ${result.detail}` : ''}`,
  );
  return {
    text: result.text,
    style: {
      language,
      dialectId: entry.id,
      rendered: result.rendered,
      ...(result.reason && { reason: result.reason }),
    },
  };
}

/**
 * A conversational reply (smalltalk / clarify / out of scope) may repeat facts the assistant
 * already gave, never new ones: "ki keh raho he" must not turn into a fresh, unsourced scheme
 * answer. Facts are numbers, rupee amounts, URLs and phone numbers.
 */
function introducesNewFacts(reply: string, history: Turn[]): boolean {
  const known = mergeFacts(
    ...history.filter((turn) => turn.role === 'assistant').map((turn) => extractFacts(turn.text)),
  );
  return hasFacts(missingFacts(extractFacts(reply), known));
}

async function answerConversation(
  input: AnswerInput,
  fallbackLanguage: LanguageCode,
  dialect: DialectOutcome,
  decision: DialectDecision,
): Promise<QueryResponse> {
  let retrieved: ScoredChunk[] = [];
  const history = input.sessionId ? getHistory(input.sessionId) : [];
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
    },
    {
      text: input.text,
      history,
      dialectHint: decision.dialectId ?? undefined,
      languageHint: input.detectedLanguage ?? input.language ?? fallbackLanguage,
    },
  );

  let response: QueryResponse;
  if (result.kind === 'direct') {
    const direct = introducesNewFacts(result.answer, history)
      ? ASK_AGAIN[result.language]
      : result.answer;
    const styled = await styleReply(direct, result.language, decision);
    const smsText = truncateAtSentence(direct, env.SMS_MAX_SEGMENTS);
    response = {
      sessionId: input.sessionId ?? '',
      transcript: input.transcript,
      ...dialect,
      detectedLanguage: result.language,
      answer: styled.text,
      intent: result.intent,
      answerStyle: styled.style,
      sources: [],
      fraudWarning: '',
      smsText,
      smsSegments: countSmsSegments(smsText),
      audioUrl: null,
      usedCache: false,
      notFound: false,
    };
  } else if (result.kind === 'notFound') {
    const language = result.language ?? fallbackLanguage;
    response = {
      sessionId: input.sessionId ?? '',
      transcript: input.transcript,
      ...dialect,
      ...notFoundAnswer(language),
      intent: result.intent,
      usedCache: false,
      answerStyle: fixedTextStyle(language, decision),
    };
  } else {
    const usedChunks = retrieved.filter((chunk) => result.usedChunkIds.includes(chunk.chunkId));
    if (!result.answer || usedChunks.length === 0 || !preservesContextNumbers(result.answer, usedChunks)) {
      response = {
        sessionId: input.sessionId ?? '',
        transcript: input.transcript,
        ...dialect,
        ...notFoundAnswer(result.language),
        intent: result.intent,
        usedCache: false,
        answerStyle: fixedTextStyle(result.language, decision),
      };
    } else {
      // The SMS keeps the checked standard wording; the dialect rewording runs alongside it.
      const [{ sms }, styled] = await Promise.all([
        compressForSms({ text: result.answer, language: result.language }),
        styleReply(result.answer, result.language, decision),
      ]);
      response = {
        sessionId: input.sessionId ?? '',
        transcript: input.transcript,
        ...dialect,
        ...foundAnswer(result.language, styled.text, usedChunks, sms),
        intent: result.intent,
        usedCache: false,
        answerStyle: styled.style,
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
