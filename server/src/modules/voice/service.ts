import type { LanguageCode, QueryResponse } from '@gram-saathi/shared';
import { env, isMocked } from '../../config/env';
import { generateJson } from '../../lib/geminiClient';
import { HttpError } from '../../lib/httpError';
import { logger } from '../../lib/logger';
import { mockDetectLanguage, mockTranscribe } from '../../mocks';
import { answerQuestion } from '../chat/service';
import { answerLanguageFromTranscription } from '../dialect/language';
import {
  buildTranscribeInstruction,
  TRANSCRIBE_SYSTEM_PROMPT,
  transcriptionSchema,
} from './prompts';

export interface VoiceQueryInput {
  audio: Buffer;
  mimeType: string;
  /** Hint from the client's language selector. */
  language?: LanguageCode;
  dialectHint?: string;
  sessionId: string;
}

export type TranscribeInput = Pick<VoiceQueryInput, 'audio' | 'mimeType' | 'language'>;

export interface Transcription {
  transcript: string;
  detectedLanguage: string;
  script: string;
}

/** Speech -> text, then the same answer pipeline as typed questions. */
export async function answerVoiceQuery(input: VoiceQueryInput): Promise<QueryResponse> {
  const { transcript, detectedLanguage } = await transcribe(input);
  const language = answerLanguageFromTranscription(
    detectedLanguage,
    input.language,
    input.dialectHint,
  );
  return answerQuestion({
    text: transcript,
    language: input.language,
    dialectHint: input.dialectHint,
    detectedLanguage: language,
    dialectEvidence: {
      audio: {
        data: input.audio.toString('base64'),
        mimeType: normalizeAudioMimeType(input.mimeType),
      },
      text: transcript,
    },
    sessionId: input.sessionId,
    transcript,
  });
}

/** Transcript + language in a single Gemini call (audio in, structured JSON out). */
export async function transcribe(input: TranscribeInput): Promise<Transcription> {
  if (isMocked('voice')) {
    const transcript = mockTranscribe(input.language);
    const detectedLanguage = mockDetectLanguage(transcript, input.language);
    const script = /[஀-௿]/.test(transcript)
      ? 'Tamil'
      : /[ऀ-ॿ]/.test(transcript)
        ? 'Devanagari'
        : 'Latin';
    return { transcript, detectedLanguage, script };
  }

  const result = await generateJson({
    label: 'transcribe',
    model: env.GEMINI_AUDIO_MODEL ?? env.GEMINI_CHAT_MODEL,
    system: TRANSCRIBE_SYSTEM_PROMPT,
    input: [
      { type: 'text', text: buildTranscribeInstruction(input.language) },
      {
        type: 'audio',
        data: input.audio.toString('base64'),
        mimeType: normalizeAudioMimeType(input.mimeType),
      },
    ],
    schema: transcriptionSchema,
    maxOutputTokens: 1024,
  });

  if (!result.transcript.trim()) {
    throw new HttpError(
      422,
      'NO_SPEECH_DETECTED',
      'No speech was recognised in the recording. Ask the user to speak again.',
    );
  }
  logger.debug('transcribed voice: ' + result.detectedLanguage + ' (' + result.script + ' script)');
  return result;
}

/** Maps model script descriptions onto the contributor API's small stable script enum. */
export function contributorScript(script: string): 'devanagari' | 'roman' | 'mixed' | 'other' {
  const value = script.trim().toLowerCase();
  if (value.includes('mixed')) return 'mixed';
  if (value.includes('devanagari') || value.includes('nagari')) return 'devanagari';
  if (value.includes('latin') || value.includes('roman')) return 'roman';
  return 'other';
}

const MIME_ALIASES: Record<string, string> = {
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/mp4': 'audio/m4a',
  'audio/x-m4a': 'audio/m4a',
  'audio/x-flac': 'audio/flac',
  'audio/x-aiff': 'audio/aiff',
  'audio/x-aac': 'audio/aac',
  'audio/mpeg3': 'audio/mp3',
  'audio/x-mpeg-3': 'audio/mp3',
};

/** "audio/webm;codecs=opus" -> "audio/webm", and common aliases -> the types Gemini lists. */
export function normalizeAudioMimeType(mimeType: string): string {
  const base = mimeType.split(';')[0].trim().toLowerCase();
  return MIME_ALIASES[base] ?? base;
}
