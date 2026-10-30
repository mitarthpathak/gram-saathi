import type { LanguageCode } from '@gram-saathi/shared';
import { z } from 'zod';
import { LANGUAGES } from '../../lib/languages';

export const TRANSCRIBE_SYSTEM_PROMPT = `You transcribe short spoken questions from people in rural India about government schemes.

- Write down exactly what was said, in the language spoken and its usual script: Hindi and Marathi in Devanagari, Tamil in Tamil script, English in Latin letters. Keep English words such as scheme names as they were spoken.
- Do not translate, answer, summarise or correct the question.
- detectedLanguage: the ISO 639 code of the spoken language, e.g. "hi", "mr", "ta", "en", or a dialect code such as "bho" (Bhojpuri), "awa" (Awadhi) or "mai" (Maithili). Use "hi" for a Hindi-English mix.
- If there is no clear speech in the recording, return an empty transcript.`;

export function buildTranscribeInstruction(hint?: LanguageCode): string {
  return hint
    ? `Transcribe this recording. The app is set to ${LANGUAGES[hint].name}, but the speaker may use another language.`
    : 'Transcribe this recording.';
}

export const transcriptionSchema = z.object({
  transcript: z.string().describe('Exactly what was said, in the original language and script.'),
  detectedLanguage: z
    .string()
    .describe('ISO 639 code of the spoken language, e.g. "hi", "mr", "ta", "en" or "bho".'),
});
