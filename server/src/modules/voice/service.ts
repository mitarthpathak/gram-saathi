import type { LanguageCode, QueryResponse } from '@gram-saathi/shared';
import { env, isMocked } from '../../config/env';
import { generateJson } from '../../lib/geminiClient';
import { HttpError } from '../../lib/httpError';
import { toSupportedLanguage } from '../../lib/languages';
import { logger } from '../../lib/logger';
import { mockDetectLanguage, mockTranscribe } from '../../mocks';
import { detectTextLanguage } from '../chat/language';
import { answerQuestion } from '../chat/service';
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

export interface Transcription {
  transcript: string;
  /** Detected language, mapped to one we answer in (dialects -> base language). */
  language: LanguageCode;
}

/** Speech -> text, then the same answer pipeline as typed questions. */
export async function answerVoiceQuery(input: VoiceQueryInput): Promise<QueryResponse> {
  const { transcript, language } = await transcribe(input);
  return answerQuestion({
    text: transcript,
    language: input.language,
    dialectHint: input.dialectHint,
    detectedLanguage: language,
    sessionId: input.sessionId,
    transcript,
  });
}

/** Transcript + language in a single Gemini call (audio in, structured JSON out). */
export async function transcribe(input: VoiceQueryInput): Promise<Transcription> {
  if (isMocked('voice')) {
    const transcript = mockTranscribe(input.language);
    return { transcript, language: mockDetectLanguage(transcript, input.language) };
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

  const transcript = result.transcript.trim();
  if (!transcript) {
    throw new HttpError(
      422,
      'NO_SPEECH_DETECTED',
      'No speech was recognised in the recording. Ask the user to speak again.',
    );
  }
  const language = toSupportedLanguage(
    result.detectedLanguage,
    input.language ?? detectTextLanguage(transcript),
  );
  logger.debug(`transcript (${result.detectedLanguage} -> ${language}): ${transcript}`);
  return { transcript, language };
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
