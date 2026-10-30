import type { SmsCompressResponse } from '@gram-saathi/shared';
import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/useToast';
import { useChat } from '@/features/chat/useChat';
import { api } from '@/lib/api';
import { format, useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { FeaturePhoneMock } from './FeaturePhoneMock';
import { LowBandwidthToggle } from './LowBandwidthToggle';
import type { SmsScreenState } from './navigation';
import { OfflineFaqList } from './OfflineFaqList';
import { countSmsSegments } from './smsSegments';
import { smsStrings } from './strings';

/** SMS fallback preview on a basic phone, a text-to-SMS tool and low-bandwidth settings. */
export function SmsScreen() {
  const t = useStrings(smsStrings);
  const toast = useToast();
  const { language } = useSettings();
  const { lastAnswer } = useChat();
  // Set by "View as SMS" under a chat answer; otherwise preview the latest answer.
  const fromChat = useLocation().state as SmsScreenState | null;
  const [draft, setDraft] = useState('');
  const [compressed, setCompressed] = useState<SmsCompressResponse | null>(null);
  const [compressing, setCompressing] = useState(false);

  const preview =
    compressed ??
    fromChat ??
    (lastAnswer ? { sms: lastAnswer.smsText, segments: lastAnswer.smsSegments } : null);

  const compress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setCompressing(true);
    try {
      setCompressed(await api.smsCompress({ text, language }));
    } catch {
      toast.show(t.error, 'error');
    } finally {
      setCompressing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 px-4 py-5">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <LowBandwidthToggle />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">{t.previewTitle}</h2>
        <FeaturePhoneMock sms={preview?.sms ?? null} segments={preview?.segments ?? 0} />
      </section>

      <form onSubmit={(event) => void compress(event)} className="flex flex-col gap-2">
        <label htmlFor="sms-draft" className="text-lg font-bold">
          {t.composeLabel}
        </label>
        <textarea
          id="sms-draft"
          rows={4}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t.composePlaceholder}
          className="rounded-xl border-2 border-slate-300 bg-white p-3 text-lg focus:border-brand-600 focus:outline-none"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-base text-slate-600">
            {draft.trim() && format(t.draftCount, { segments: countSmsSegments(draft.trim()) })}
          </span>
          <Button type="submit" size="lg" disabled={compressing || !draft.trim()}>
            {t.compress}
          </Button>
        </div>
      </form>

      <OfflineFaqList key={language} />
    </div>
  );
}
