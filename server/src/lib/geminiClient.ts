/**
 * The single place where the server talks to Gemini. Modules call these functions and never
 * import the SDK directly, so models, retries and rate limits are handled in one spot.
 *
 * Empty in step 1: every module serves mock data while USE_MOCKS is on, and the non-mock
 * paths end up here and fail with 501 NOT_IMPLEMENTED.
 *
 * TODO(step-2): `npm install @google/genai -w server`, create one client from
 * env.GEMINI_API_KEY and implement the functions below with env.GEMINI_CHAT_MODEL /
 * env.GEMINI_EMBED_MODEL. Keep prompts in the module that owns them (chat, voice, sms).
 */
import { NotImplementedError } from './httpError';

export interface GenerateTextOptions {
  /** System instruction, e.g. the grounding rules for answers. */
  system?: string;
  /** Ask for a JSON response (structured output). */
  json?: boolean;
  temperature?: number;
}

export interface Transcription {
  transcript: string;
  /** Detected language or dialect code, e.g. "hi", "mr", "bho". */
  language: string;
}

export async function generateText(
  _prompt: string,
  _options: GenerateTextOptions = {},
): Promise<string> {
  throw new NotImplementedError('geminiClient.generateText');
}

/** Speech-to-text plus language detection in one call (Gemini accepts audio input). */
export async function transcribeAudio(
  _audio: Buffer,
  _mimeType: string,
  _languageHint?: string,
): Promise<Transcription> {
  throw new NotImplementedError('geminiClient.transcribeAudio');
}

/** Embeddings for retrieval. TODO(step-3): store them in the vector DB used by modules/rag. */
export async function embedTexts(_texts: string[]): Promise<number[][]> {
  throw new NotImplementedError('geminiClient.embedTexts');
}
