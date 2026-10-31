/**
 * Server speech (POST /api/tts) with Gemini TTS, through the shared Gemini client (retries,
 * timeouts, typed errors, concurrency cap). Every failure returns `{ audioUrl: null, basis: 'none' }`
 * so the client falls back to browser speech. The answer text is spoken exactly as written:
 * only Markdown markers and emoji are removed, and no instruction is ever added to it.
 */
import { createHash } from 'node:crypto';
import type { TtsBasis, TtsRequest, TtsResponse } from '@gram-saathi/shared';
import { env, isMocked } from '../../config/env';
import { LruCache } from '../../lib/cache';
import { classifyGeminiError, synthesizeAudio, type SpeechResult } from '../../lib/geminiClient';
import { logger } from '../../lib/logger';
import { concatPcm, encodeWav, isWav, parseWav, type PcmAudio } from '../../lib/wav';
import { getDialectEntry } from '../dialect/registry';
import { dialectRenderEntry } from '../dialect/renderConfig';
import { cleanTextForSpeech, splitForSpeech } from './speechText';
import { chooseVoice, getTtsVoices, type TtsVoices } from './voices';

/** Audio larger than this (as a data URL) is dropped: the client uses browser speech instead. */
export const MAX_AUDIO_DATA_URL_CHARS = 3_000_000;
/** The default rate that the API is documented to support. */
const FALLBACK_SAMPLE_RATE = 24_000;
/** Silence between the pieces of a split answer. */
const PIECE_GAP_MS = 250;

export interface TtsSettings {
  mocked: boolean;
  apiKey: string;
  /** `none` disables server speech. */
  model: string;
  /** Used when a dialect is present; `none` means `model`. */
  dialectModel: string;
  sampleRate: number;
  timeoutMs: number;
  maxChars: number;
  style: string;
  maxRetries: number;
  maxDataUrlChars: number;
  voices: TtsVoices;
}

export function ttsSettingsFromEnv(): TtsSettings {
  return {
    mocked: isMocked('tts'),
    apiKey: env.GEMINI_API_KEY ?? '',
    model: env.GEMINI_TTS_MODEL,
    dialectModel: env.GEMINI_TTS_DIALECT_MODEL,
    sampleRate: env.GEMINI_TTS_SAMPLE_RATE,
    timeoutMs: env.TTS_TIMEOUT_MS ?? env.GEMINI_TTS_TIMEOUT_MS,
    maxChars: env.TTS_MAX_CHARS,
    style: env.TTS_STYLE,
    // A listener is waiting: one quick retry at most, then browser speech.
    maxRetries: Math.min(1, env.GEMINI_MAX_RETRIES),
    maxDataUrlChars: MAX_AUDIO_DATA_URL_CHARS,
    voices: getTtsVoices(),
  };
}

const isOff = (model: string) => !model || model.toLowerCase() === 'none';

/** True when server speech can be attempted (not mocked, a key and a model). */
export function isServerSpeechConfigured(
  settings: Pick<TtsSettings, 'mocked' | 'apiKey' | 'model'> = {
    mocked: isMocked('tts'),
    apiKey: env.GEMINI_API_KEY ?? '',
    model: env.GEMINI_TTS_MODEL,
  },
): boolean {
  return !settings.mocked && Boolean(settings.apiKey) && !isOff(settings.model);
}

export interface SpeechPlan {
  model: string;
  voice: string;
  voiceSource: string;
  /** The dialect actually applied (null when absent or not of this language). */
  dialectId: string | null;
  basis: Exclude<TtsBasis, 'none'>;
}

/** Model, voice and basis for a request. Pure apart from reading the dialect registry. */
export function planSpeech(
  request: Pick<TtsRequest, 'language' | 'dialectId'>,
  settings: Pick<TtsSettings, 'model' | 'dialectModel' | 'voices'>,
): SpeechPlan {
  const entry = request.dialectId ? getDialectEntry(request.dialectId) : undefined;
  // A dialect of another language cannot describe this text; ignore it.
  const dialectId = entry && entry.parentLanguage === request.language ? entry.id : null;
  const voice = chooseVoice(request.language, dialectId, settings.voices);
  const model = dialectId && !isOff(settings.dialectModel) ? settings.dialectModel : settings.model;
  const basis: SpeechPlan['basis'] = !dialectId
    ? 'language'
    : dialectRenderEntry(dialectId).ttsNamedLanguage
      ? 'named-dialect'
      : 'base-language-approximation';
  return { model, voice: voice.voice, voiceSource: voice.source, dialectId, basis };
}

const NO_AUDIO: TtsResponse = { audioUrl: null, basis: 'none' };

// Per process: finished audio by hash(text, voice, model, rate, style), and sample rates the API
// turned down (so later calls go straight to the fallback rate).
const audioCache = new LruCache<string>({ maxEntries: 24, ttlMs: 60 * 60 * 1000 });
const rejectedRates = new Set<number>();

/** For tests. */
export function resetTtsState(): void {
  audioCache.clear();
  rejectedRates.clear();
}

function cacheKey(parts: Array<string | number>): string {
  return createHash('sha256').update(parts.join('\u0000')).digest('hex');
}

function toPcm(result: SpeechResult, sampleRate: number): PcmAudio | undefined {
  if (isWav(result.audio)) return parseWav(result.audio);
  // Headerless audio is only usable when it is 16-bit linear PCM (audio/l16).
  if (/mulaw|alaw/i.test(result.mimeType)) return undefined;
  return { sampleRate, channels: 1, bitsPerSample: 16, data: result.audio };
}

async function synthesizePiece(
  text: string,
  plan: SpeechPlan,
  settings: TtsSettings,
): Promise<{ result: SpeechResult; sampleRate: number }> {
  const call = (sampleRate: number) =>
    synthesizeAudio({
      model: plan.model,
      text,
      voice: plan.voice,
      style: settings.style || undefined,
      sampleRate,
      timeoutMs: settings.timeoutMs,
      maxRetries: settings.maxRetries,
    }).then((result) => ({ result, sampleRate }));

  const preferred = rejectedRates.has(settings.sampleRate)
    ? FALLBACK_SAMPLE_RATE
    : settings.sampleRate;
  try {
    return await call(preferred);
  } catch (error) {
    // The docs list 24000, 16000 and 8000; if the API refuses the smaller rate, use the default.
    if (preferred === FALLBACK_SAMPLE_RATE || classifyGeminiError(error)?.kind !== 'bad_request') {
      throw error;
    }
    const retried = await call(FALLBACK_SAMPLE_RATE);
    rejectedRates.add(preferred);
    logger.warn(`TTS: sample rate ${preferred} was rejected; using ${FALLBACK_SAMPLE_RATE}`);
    return retried;
  }
}

class SpeechAssemblyError extends Error {}

/** One WAV for all pieces (a single WAV piece is passed through untouched). */
function assemble(pieces: Array<{ result: SpeechResult; sampleRate: number }>): Buffer {
  const [only] = pieces;
  if (pieces.length === 1 && only && isWav(only.result.audio)) return only.result.audio;
  const pcm = pieces.map((piece) => toPcm(piece.result, piece.sampleRate));
  if (pcm.some((part) => part === undefined)) {
    throw new SpeechAssemblyError('unsupported audio encoding');
  }
  const joined = concatPcm(pcm as PcmAudio[], PIECE_GAP_MS);
  if (!joined) throw new SpeechAssemblyError('pieces have different audio formats');
  return encodeWav(joined);
}

/**
 * Speaks `request.text`. Never throws for provider problems: the result is then
 * `{ audioUrl: null, basis: 'none' }`. Logs carry no text and no keys.
 */
export async function synthesizeSpeech(
  request: TtsRequest,
  overrides: Partial<TtsSettings> = {},
): Promise<TtsResponse> {
  const settings = { ...ttsSettingsFromEnv(), ...overrides };
  if (!isServerSpeechConfigured(settings)) return NO_AUDIO;

  const text = cleanTextForSpeech(request.text);
  if (!text) return NO_AUDIO;
  const plan = planSpeech(request, settings);
  const rate = rejectedRates.has(settings.sampleRate) ? FALLBACK_SAMPLE_RATE : settings.sampleRate;
  const key = cacheKey([text, plan.voice, plan.model, rate, settings.style]);
  const cached = audioCache.get(key);
  if (cached) return { audioUrl: cached, basis: plan.basis };

  const startedAt = Date.now();
  const pieces = splitForSpeech(text, settings.maxChars);
  try {
    const audio = assemble(
      await Promise.all(pieces.map((piece) => synthesizePiece(piece, plan, settings))),
    );
    const audioUrl = `data:audio/wav;base64,${audio.toString('base64')}`;
    if (audioUrl.length > settings.maxDataUrlChars) {
      logger.warn(
        `TTS: audio of ${audioUrl.length} chars is over the ${settings.maxDataUrlChars} cap; using browser speech`,
      );
      return NO_AUDIO;
    }
    audioCache.set(key, audioUrl);
    logger.debug(
      `TTS: ${plan.model} ${plan.voiceSource} ${plan.basis}, ${pieces.length} piece(s), ` +
        `${audio.length} bytes in ${Date.now() - startedAt} ms`,
    );
    return { audioUrl, basis: plan.basis };
  } catch (error) {
    const kind =
      error instanceof SpeechAssemblyError
        ? 'bad_audio'
        : (classifyGeminiError(error)?.kind ?? 'unexpected');
    logger.warn(`TTS failed (${kind}, ${plan.model}); the client uses browser speech`);
    return NO_AUDIO;
  }
}
