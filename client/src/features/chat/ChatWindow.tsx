import { ArrowRight, FileSearch, Languages, MessageSquareText, Mic } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { dialectStrings } from '@/features/dialect/strings';
import { useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { MessageBubble } from './MessageBubble';
import { SCHEME_SHORTCUTS } from './schemes';
import { chatStrings } from './strings';
import { useChat } from './useChat';
import { useDemo } from '@/features/demo/useDemo';
import { DEMO_SAMPLES } from '@/features/demo/demoData';

/** The scrolling transcript: questions, answers with sources and fraud warnings. */
export function ChatWindow() {
  const { messages, busy } = useChat();
  const { enabled: demoMode } = useDemo();
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view (but open the welcome screen at the top).
  useEffect(() => {
    if (messages.length > 0 || busy) {
      const latest = messages.at(-1);
      if (latest?.role === 'assistant' && latest.via === 'voice') {
        const transcripts =
          endRef.current?.parentElement?.querySelectorAll('[data-voice-transcript]');
        transcripts
          ?.item(transcripts.length - 1)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, busy]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <ol aria-live="polite" className="flex flex-col gap-4">
          {messages.map((message) => (
            <li key={message.id}>
              <MessageBubble message={message} />
            </li>
          ))}
        </ol>
      )}
      {busy && <TypingIndicator />}
      {demoMode && <DemoSamplePicker />}
      <div ref={endRef} />
    </div>
  );
}

function DemoSamplePicker() {
  const { askDemo, busy } = useChat();
  return (
    <section
      aria-label="Cached demo questions"
      className="my-4 rounded-2xl bg-brand-50 p-3 ring-1 ring-brand-200"
    >
      <p className="text-base font-extrabold text-brand-950">
        Demo samples <span className="font-medium text-brand-800">· press D to hide</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {DEMO_SAMPLES.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={busy}
            onClick={() => askDemo(item.id)}
            className="inline-flex min-h-12 items-center rounded-full bg-white px-4 text-base font-bold text-brand-900 ring-1 ring-brand-200 hover:ring-brand-500 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:opacity-50"
          >
            {item.title}
          </button>
        ))}
      </div>
    </section>
  );
}

/** "Finding the answer…" bubble with bouncing dots while a question is being answered. */
export function TypingIndicator() {
  const t = useStrings(chatStrings);
  return (
    <div role="status" className="mt-4 flex animate-fade-up items-end gap-2.5">
      <Logo className="size-8 rounded-[0.6rem]" />
      <div className="w-full max-w-sm rounded-3xl rounded-bl-md bg-white p-4 shadow-soft ring-1 ring-brand-950/5">
        <span aria-hidden className="flex gap-1">
          {[0, 0.15, 0.3].map((delay) => (
            <span
              key={delay}
              className="size-2 animate-dot rounded-full bg-brand-500"
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
        </span>
        <span className="mt-2 block text-base font-semibold text-slate-700">{t.thinking}</span>
        <div aria-hidden className="mt-3 grid gap-2">
          <span className="h-4 w-11/12 animate-pulse rounded-full bg-brand-100" />
          <span className="h-4 w-9/12 animate-pulse rounded-full bg-brand-100" />
          <span className="h-4 w-7/12 animate-pulse rounded-full bg-marigold-100" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  const t = useStrings(chatStrings);
  const dialectT = useStrings(dialectStrings);
  const { language } = useSettings();
  const { askText, busy } = useChat();

  return (
    <div className="flex animate-fade-up flex-col gap-6">
      <section className="relative overflow-hidden rounded-3xl bg-white p-5 shadow-soft ring-1 ring-brand-950/5">
        <div
          aria-hidden
          className="absolute -top-10 -right-8 size-36 rounded-full bg-marigold-200/60 blur-2xl"
        />
        <p className="relative text-sm font-extrabold text-marigold-700">{t.greeting} 🙏</p>
        <h1 className="relative mt-1 text-[1.6rem] leading-tight font-extrabold tracking-tight text-balance text-slate-900">
          {t.emptyTitle}
        </h1>
        <p className="relative mt-2 text-base text-slate-600">{t.emptyHint}</p>
        <Link
          to="/dialects"
          className="relative mt-2 inline-flex min-h-12 items-center gap-2 rounded-xl px-2 font-bold text-brand-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <Languages aria-hidden className="size-5" />
          {dialectT.title}
        </Link>
      </section>

      <section>
        <h2 className="mb-2.5 px-1 text-xs font-extrabold tracking-[0.14em] text-slate-500 uppercase">
          {t.popularTitle}
        </h2>
        <div className="grid gap-2.5">
          {SCHEME_SHORTCUTS.slice(0, 3).map(({ id, Icon, tone, question }) => (
            <button
              key={id}
              type="button"
              disabled={busy}
              onClick={() => void askText(question[language])}
              className="group flex min-h-14 items-center gap-3 rounded-2xl bg-white p-3 text-left text-lg font-bold text-slate-800 shadow-soft ring-1 ring-brand-950/10 transition hover:-translate-y-0.5 hover:ring-brand-400 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:scale-[0.98] disabled:opacity-60"
            >
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone}`}
              >
                <Icon aria-hidden className="size-6" />
              </span>
              <span className="min-w-0 leading-snug">{question[language]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-brand-900 p-4 text-white">
        <h2 className="text-xs font-extrabold tracking-[0.14em] text-brand-200 uppercase">
          {t.howTitle}
        </h2>
        <ol className="mt-3 flex items-start justify-between gap-1">
          {[
            { Icon: Mic, label: t.step1 },
            { Icon: FileSearch, label: t.step2 },
            { Icon: MessageSquareText, label: t.step3 },
          ].map(({ Icon, label }, index) => (
            <li key={label} className="flex flex-1 items-start gap-1">
              <span className="flex flex-1 flex-col items-center gap-2 text-center">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                  <Icon aria-hidden className="size-5 text-marigold-300" />
                </span>
                <span className="text-xs leading-snug font-semibold text-brand-50">{label}</span>
              </span>
              {index < 2 && (
                <ArrowRight aria-hidden className="mt-3.5 size-4 shrink-0 text-brand-300" />
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
