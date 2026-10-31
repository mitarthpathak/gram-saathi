import type { LanguageCode } from '@gram-saathi/shared';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import { ChatProvider } from '@/features/chat/ChatProvider';
import { DemoProvider } from '@/features/demo/DemoProvider';
import { detectBrowserLanguage, getLanguage } from '@/features/language/languages';
import { SettingsContext, type Settings } from '@/lib/settings';
import { storage } from '@/lib/storage';
import { readDialectHint, writeDialectHint } from '@/features/dialect/dialectLogic';
import { MotionProvider } from '@/lib/motion/MotionProvider';

const KEYS = {
  language: 'gs:language',
  languageHint: 'gs:languageHint',
  lowBandwidth: 'gs:lowBandwidth',
  sessionId: 'gs:sessionId',
};

function initialLanguage(): LanguageCode {
  return getLanguage(storage.get(KEYS.language) ?? '')?.code ?? detectBrowserLanguage();
}

function initialSessionId(): string {
  const saved = storage.get(KEYS.sessionId);
  if (saved) return saved;
  // crypto.randomUUID only exists on https/localhost; phones testing over LAN http lack it.
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  storage.set(KEYS.sessionId, id);
  return id;
}

function SettingsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState(initialLanguage);
  const [languageHint, setLanguageHintState] = useState<LanguageCode | null>(() => {
    const savedHint = storage.get(KEYS.languageHint);
    if (savedHint === 'auto') return null;
    if (savedHint) return getLanguage(savedHint)?.code ?? null;
    return getLanguage(storage.get(KEYS.language) ?? '')?.code ?? null;
  });
  const [dialectHint, setDialectHintState] = useState<string | null>(
    () => readDialectHint(storage),
  );
  const [lowBandwidth, setLowBandwidthState] = useState(
    () => storage.get(KEYS.lowBandwidth) === 'true',
  );
  const [sessionId] = useState(initialSessionId);

  // Screen readers and font fallback use the page language.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const settings = useMemo<Settings>(
    () => ({
      language,
      setLanguage: (next) => {
        storage.set(KEYS.language, next);
        storage.set(KEYS.languageHint, next);
        setLanguageState(next);
        setLanguageHintState(next);
      },
      languageHint,
      setLanguageHint: (next) => {
        storage.set(KEYS.languageHint, next ?? 'auto');
        setLanguageHintState(next);
      },
      dialectHint,
      setDialectHint: (next) => {
        writeDialectHint(storage, next);
        setDialectHintState(next);
      },
      lowBandwidth,
      setLowBandwidth: (on) => {
        storage.set(KEYS.lowBandwidth, String(on));
        setLowBandwidthState(on);
      },
      sessionId,
    }),
    [language, languageHint, dialectHint, lowBandwidth, sessionId],
  );

  return <SettingsContext value={settings}>{children}</SettingsContext>;
}

/** Every app-wide provider. Feature providers get registered here. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <DemoProvider>
      <SettingsProvider>
        <MotionProvider>
          <ToastProvider>
            <ChatProvider>{children}</ChatProvider>
          </ToastProvider>
        </MotionProvider>
      </SettingsProvider>
    </DemoProvider>
  );
}
