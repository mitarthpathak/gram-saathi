import type { LanguageCode } from '@gram-saathi/shared';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import { ChatProvider } from '@/features/chat/ChatProvider';
import { detectBrowserLanguage, getLanguage } from '@/features/language/languages';
import { MotionProvider } from '@/lib/motion/MotionProvider';
import { SettingsContext, type Settings } from '@/lib/settings';
import { storage } from '@/lib/storage';

const KEYS = {
  language: 'gs:language',
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
        setLanguageState(next);
      },
      lowBandwidth,
      setLowBandwidth: (on) => {
        storage.set(KEYS.lowBandwidth, String(on));
        setLowBandwidthState(on);
      },
      sessionId,
    }),
    [language, lowBandwidth, sessionId],
  );

  return <SettingsContext value={settings}>{children}</SettingsContext>;
}

/** Every app-wide provider. Feature providers get registered here. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <MotionProvider>
        <ToastProvider>
          <ChatProvider>{children}</ChatProvider>
        </ToastProvider>
      </MotionProvider>
    </SettingsProvider>
  );
}
