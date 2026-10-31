/**
 * What the Gemini TTS docs say about languages, as checked by the agent (not by a model call).
 * Source: https://ai.google.dev/gemini-api/docs/speech-generation (page "last updated
 * 2026-10-28 UTC", read 2026-10-31). Both gemini-3.8-flash-tts and gemini-3.8-flash-lite-tts list
 * every entry below; the TTS models detect the language from the text (no language parameter).
 * Re-check the page before relying on this list.
 */
export const TTS_DOCS = {
  url: 'https://ai.google.dev/gemini-api/docs/speech-generation',
  pageUpdated: '2026-10-28',
  checked: '2026-10-31',
} as const;

/** Rows of the readiness matrix whose language the TTS table names explicitly. */
export const TTS_NAMED_LANGUAGES: Readonly<Record<string, string>> = {
  hi: 'Hindi',
  mr: 'Marathi',
  ta: 'Tamil',
  en: 'English',
  awadhi: 'Awadhi',
  bhojpuri: 'Bhojpuri',
};

/** Hindi-belt varieties the table names that are not (yet) registry dialects. */
export const TTS_OTHER_NAMED_INDIC = ['Chhattisgarhi', 'Magahi', 'Maithili'] as const;
