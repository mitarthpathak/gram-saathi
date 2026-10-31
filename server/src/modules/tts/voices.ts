import type { LanguageCode } from '@gram-saathi/shared';
import { z } from 'zod';
import voicesFile from '../../config/tts-voices.json';

const voiceEntrySchema = z
  .object({
    /** Prebuilt voice name, e.g. "Kore". */
    voice: z.string().trim().min(1).optional(),
    /** Voice Library id (or an owner-created voice id); wins over `voice`. */
    voiceId: z.string().trim().min(1).optional(),
    /** "to-be-auditioned" until a person has listened to it in this language. */
    status: z.enum(['to-be-auditioned', 'auditioned']),
    note: z.string().optional(),
  })
  .refine((entry) => Boolean(entry.voice || entry.voiceId), 'set "voice" or "voiceId"');

export const ttsVoicesSchema = z.object({
  languages: z.object({
    hi: voiceEntrySchema,
    mr: voiceEntrySchema,
    ta: voiceEntrySchema,
    en: voiceEntrySchema,
  }),
  dialects: z.record(z.string(), voiceEntrySchema),
});

export type TtsVoiceEntry = z.infer<typeof voiceEntrySchema>;
export type TtsVoices = z.infer<typeof ttsVoicesSchema>;

let parsed: TtsVoices | undefined;

/** server/src/config/tts-voices.json, validated on first use. */
export function getTtsVoices(): TtsVoices {
  parsed ??= ttsVoicesSchema.parse(voicesFile);
  return parsed;
}

export interface ChosenVoice {
  /** What goes into speech_config.voice. */
  voice: string;
  /** Which entry supplied it, e.g. "languages.hi" or "dialects.braj". */
  source: string;
  status: TtsVoiceEntry['status'];
}

/** The dialect's own voice when one is configured, else the language voice. */
export function chooseVoice(
  language: LanguageCode,
  dialectId: string | null,
  voices: TtsVoices = getTtsVoices(),
): ChosenVoice {
  const dialectEntry = dialectId ? voices.dialects[dialectId] : undefined;
  const entry = dialectEntry ?? voices.languages[language];
  return {
    voice: (entry.voiceId ?? entry.voice) as string,
    source: dialectEntry ? `dialects.${dialectId}` : `languages.${language}`,
    status: entry.status,
  };
}
