import type { LanguageCode } from '@gram-saathi/shared';
import { createContext, useContext } from 'react';

/** App-wide user settings, provided by app/providers.tsx and saved in localStorage. */
export interface Settings {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  /** Voice-language hint. null means auto-detect. */
  languageHint: LanguageCode | null;
  setLanguageHint: (language: LanguageCode | null) => void;
  /** Remembered dialect correction for subsequent voice questions. */
  dialectHint: string | null;
  setDialectHint: (dialectId: string | null) => void;
  /** Text-first mode for slow networks: no server audio, top answers saved for offline use. */
  lowBandwidth: boolean;
  setLowBandwidth: (on: boolean) => void;
  /** Anonymous id sent with every API call. */
  sessionId: string;
}

export const SettingsContext = createContext<Settings | null>(null);

export function useSettings(): Settings {
  const settings = useContext(SettingsContext);
  if (!settings) throw new Error('useSettings must be used inside <AppProviders>');
  return settings;
}
