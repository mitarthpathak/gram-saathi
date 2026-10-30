import type { LanguageCode } from '@gram-saathi/shared';

export interface LanguageOption {
  code: LanguageCode;
  /** Name in its own script, so people recognise it without reading English. */
  nativeName: string;
  englishName: string;
  /** BCP-47 tag for speech synthesis / recognition. */
  speechTag: string;
}

// A Record keyed by LanguageCode: the build fails if the contract gains a language missing here.
const LANGUAGE_MAP: Record<LanguageCode, LanguageOption> = {
  hi: { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', speechTag: 'hi-IN' },
  mr: { code: 'mr', nativeName: 'मराठी', englishName: 'Marathi', speechTag: 'mr-IN' },
  ta: { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil', speechTag: 'ta-IN' },
  en: { code: 'en', nativeName: 'English', englishName: 'English', speechTag: 'en-IN' },
};

export const LANGUAGES: LanguageOption[] = Object.values(LANGUAGE_MAP);

/** Looks up a code from the API or storage, which may be a dialect we have no UI for. */
export function getLanguage(code: string): LanguageOption | undefined {
  return Object.hasOwn(LANGUAGE_MAP, code) ? LANGUAGE_MAP[code as LanguageCode] : undefined;
}

/** First browser language we support (hi-IN -> hi), otherwise Hindi. */
export function detectBrowserLanguage(): LanguageCode {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const option = getLanguage(tag.slice(0, 2).toLowerCase());
    if (option) return option.code;
  }
  return 'hi';
}
