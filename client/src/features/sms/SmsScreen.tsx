import type { SmsCompressResponse } from '@gram-saathi/shared';
import { MessageSquareText, Wand2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import { Mascot } from '@/components/art/Mascot';
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
  const state = useLocation().state as Partial<SmsScreenState> | null;
  const fromChat = state?.sms ? { sms: state.sms, segments: state.segments ?? 1 } : null;
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
    <div className="flex animate-fade-up flex-col gap-6 px-4 py-5">
      <section className="relative overflow-hidden rounded-card bg-sky p-5 pr-24 shadow-soft ring-1 ring-sky-200">
        <Mascot mood="listening" className="absolute top-3 right-3 w-[4.5rem]" />
        <div aria-hidden className="absolute inset-0 opacity-40" />
        <span className="relative flex size-11 items-center justify-center rounded-2xl bg-white shadow-soft">
          <MessageSquareText aria-hidden className="size-6 text-leaf-600" />
        </span>
        <h1 className="relative mt-3 font-display text-2xl font-extrabold tracking-display">
          {t.title}
        </h1>
        <p className="relative mt-1 text-base text-ink-soft">{t.subtitle}</p>
      </section>

      <LowBandwidthToggle />

      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-xs font-extrabold tracking-[0.14em] text-ink-soft uppercase">
          {t.previewTitle}
        </h2>
        <FeaturePhoneMock sms={preview?.sms ?? null} segments={preview?.segments ?? 0} />
      </section>

      <form
        onSubmit={(event) => void compress(event)}
        className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-soft ring-1 ring-ink/5"
      >
        <label htmlFor="sms-draft" className="text-base font-extrabold">
          {t.composeLabel}
        </label>
        <textarea
          id="sms-draft"
          rows={4}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t.composePlaceholder}
          className="rounded-2xl bg-paper p-3 text-base ring-1 ring-ink/10 placeholder:text-ink-soft focus:ring-2 focus:ring-leaf-500 focus:outline-none"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink-soft">
            {draft.trim() && format(t.draftCount, { segments: countSmsSegments(draft.trim()) })}
          </span>
          <Button type="submit" size="md" disabled={compressing || !draft.trim()}>
            <Wand2 aria-hidden className="size-5" />
            {t.compress}
          </Button>
        </div>
      </form>

      <OfflineFaqList key={language} />
    </div>
  );
}
