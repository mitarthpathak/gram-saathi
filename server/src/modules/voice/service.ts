import type { LanguageCode, QueryResponse } from '@gram-saathi/shared';
import { isMocked } from '../../config/env';
import { transcribeAudio } from '../../lib/geminiClient';
import { mockTranscribe } from '../../mocks';
import { answerQuestion } from '../chat/service';

export interface VoiceQueryInput {
  audio: Buffer;
  mimeType: string;
  language?: LanguageCode;
  sessionId: string;
}

/** Speech -> text, then the same answer pipeline as typed questions. */
export async function answerVoiceQuery(input: VoiceQueryInput): Promise<QueryResponse> {
  const transcript = await transcribe(input);
  return answerQuestion({
    text: transcript,
    language: input.language,
    sessionId: input.sessionId,
    transcript,
  });
}

async function transcribe({ audio, mimeType, language }: VoiceQueryInput): Promise<string> {
  if (isMocked('voice')) return mockTranscribe(language);
  // TODO(step-2): implement transcribeAudio in lib/geminiClient (speech-to-text + language id),
  //   then pass the detected language to answerQuestion instead of the client's hint.
  const { transcript } = await transcribeAudio(audio, mimeType, language);
  return transcript;
}
