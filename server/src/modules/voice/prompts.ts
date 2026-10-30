import type { LanguageCode } from '@gram-saathi/shared';
import { z } from 'zod';
import { LANGUAGES } from '../../lib/languages';

export const TRANSCRIBE_SYSTEM_PROMPT = `You transcribe short spoken questions from people in rural India about government schemes.

- Transcribe EXACTLY what the speaker says, in the script they would write. Use Devanagari for Hindi-belt speech, including dialects; Tamil script for Tamil; Latin script for English.
- Keep dialect words and spellings. Never translate, normalize to standard Hindi, correct, answer, or summarize the question.
- Return detectedLanguage as "hi", "mr", "ta", "en", "gujarati", "punjabi", or "other_language". For a Hindi-belt dialect, use its parent language code "hi"; classify the dialect separately.
- Return script as the script used in the transcript (for example "Devanagari", "Tamil", "Latin", "Gujarati", "Gurmukhi", or "Other"). If the transcript uses multiple scripts, say "mixed".
- If there is no clear speech in the recording, return an empty transcript.`;

export function buildTranscribeInstruction(hint?: LanguageCode): string {
  return hint
    ? `Transcribe this recording verbatim. The selected answer language is ${LANGUAGES[hint].name}, but the speaker may use another language or regional variety. Do not change the transcript to match the selection.`
    : 'Transcribe this recording verbatim without changing its language or variety.';
}

export const transcriptionSchema = z.object({
  transcript: z.string().describe('Verbatim words in the script the speaker would write.'),
  detectedLanguage: z
    .string()
    .describe('"hi", "mr", "ta", "en", "gujarati", "punjabi", or "other_language".'),
  script: z.string().describe('The script used in the transcript, for example "Devanagari".'),
});
