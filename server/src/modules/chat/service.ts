import type { LanguageCode, QueryResponse, RetrievedChunk } from '@gram-saathi/shared';
import { isMocked } from '../../config/env';
import { TtlCache } from '../../lib/cache';
import { NotImplementedError } from '../../lib/httpError';
import { mockDetectLanguage, mockGenerateAnswer } from '../../mocks';
import { searchSchemes } from '../rag/service';
import { countSmsSegments } from '../sms/service';
import { getFraudWarning } from './fraudWarning';

export interface AnswerInput {
  text: string;
  /** Hint from the client's language selector. */
  language?: LanguageCode;
  sessionId: string;
  /** Set when `text` came from speech-to-text. */
  transcript?: string;
}

interface GeneratedAnswer {
  answer: string;
  smsText: string;
  notFound: boolean;
}

const answerCache = new TtlCache<QueryResponse>(30 * 60 * 1000);

/**
 * The answer pipeline shared by text and voice queries:
 * detect language -> retrieve scheme chunks -> grounded answer -> SMS version + fraud warning.
 */
export async function answerQuestion(input: AnswerInput): Promise<QueryResponse> {
  const language = await detectLanguage(input.text, input.language);

  const cacheKey = `${language}:${normalizeQuestion(input.text)}`;
  const cached = answerCache.get(cacheKey);
  if (cached) {
    return { ...cached, sessionId: input.sessionId, transcript: input.transcript, usedCache: true };
  }

  const chunks = await searchSchemes({ query: input.text, language, topK: 3 });
  const { answer, smsText, notFound } = await generateAnswer(input.text, language, chunks);

  const response: QueryResponse = {
    sessionId: input.sessionId,
    transcript: input.transcript,
    detectedLanguage: language,
    answer,
    sources: notFound
      ? []
      : chunks.map(({ schemeId, schemeName, section, text }) => ({
          schemeId,
          schemeName,
          section,
          snippet: text,
        })),
    fraudWarning: getFraudWarning(language),
    smsText,
    smsSegments: countSmsSegments(smsText),
    // TODO(step-2): optional server TTS (modules/tts); null tells the client to use browser speech.
    audioUrl: null,
    usedCache: false,
    notFound,
  };
  answerCache.set(cacheKey, response);
  return response;
}

async function detectLanguage(text: string, hint?: LanguageCode): Promise<LanguageCode> {
  if (isMocked('chat')) return mockDetectLanguage(text, hint);
  // TODO(step-2): detect the language (and dialect) of `text` with Gemini, using `hint` as a
  //   tie-breaker for romanised text. Script alone is enough for Tamil vs Devanagari.
  throw new NotImplementedError('chat.detectLanguage');
}

async function generateAnswer(
  question: string,
  language: LanguageCode,
  chunks: RetrievedChunk[],
): Promise<GeneratedAnswer> {
  if (isMocked('chat')) return mockGenerateAnswer(chunks, language);
  // TODO(step-2): grounded generation with lib/geminiClient.generateText:
  //   - no chunks above the relevance threshold -> return notFound without calling the model
  //   - system prompt: answer ONLY from `chunks`, in `language`, in short simple sentences,
  //     never invent amounts or dates; if the chunks don't answer it, set notFound
  //   - ask for JSON { answer, smsText, notFound }; keep smsText within 2 SMS segments
  //     (or call sms/service.compressForSms on the answer)
  throw new NotImplementedError('chat.generateAnswer');
}

/** Cache key normalisation: case, punctuation (incl. the Devanagari danda) and spacing. */
function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s?!.,।]+/g, ' ')
    .trim();
}
