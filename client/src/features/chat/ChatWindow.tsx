import { ArrowRight, FileSearch, MessageSquareText, Mic } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Logo } from '@/components/brand/Logo';
import { LanguageSelector } from '@/features/language/LanguageSelector';
import { useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { MessageBubble } from './MessageBubble';
import { SCHEME_SHORTCUTS } from './schemes';
import { chatStrings } from './strings';
import { useChat } from './useChat';

/** The scrolling transcript: questions, answers with sources and fraud warnings. */
export function ChatWindow() {
  const { messages, busy } = useChat();
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view (but open the welcome screen at the top).
  useEffect(() => {
    if (messages.length > 0 || busy) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, busy]);

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
      <div ref={endRef} />
    </div>
  );
}

/** "Finding the answer…" bubble with bouncing dots while a question is being answered. */
export function TypingIndicator() {
  const t = useStrings(chatStrings);
  return (
    <div role="status" className="mt-4 flex animate-fade-up items-end gap-2.5">
      <Logo className="size-8 rounded-[0.6rem]" />
      <div className="flex items-center gap-3 rounded-3xl rounded-bl-md bg-white px-4 py-3 shadow-soft ring-1 ring-ink/5">
        <span aria-hidden className="flex gap-1">
          {[0, 0.15, 0.3].map((delay) => (
            <span
              key={delay}
              className="size-2 animate-dot rounded-full bg-leaf-500"
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
        </span>
        <span className="text-base font-semibold text-slate-600">{t.thinking}</span>
      </div>
    </div>
  );
}

function EmptyState() {
  const t = useStrings(chatStrings);
  const { language } = useSettings();
  const { askText, busy } = useChat();

  return (
    <div className="flex animate-fade-up flex-col gap-6">
      <section className="relative overflow-hidden rounded-3xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
        <div
          aria-hidden
          className="absolute -top-10 -right-8 size-36 rounded-full bg-marigold-200/60 blur-2xl"
        />
        <p className="relative text-sm font-extrabold text-accent-strong">{t.greeting} 🙏</p>
        <h1 className="relative mt-1 text-[1.6rem] leading-tight font-extrabold tracking-tight text-balance text-slate-900">
          {t.emptyTitle}
        </h1>
        <p className="relative mt-2 text-base text-slate-600">{t.emptyHint}</p>
        <LanguageSelector variant="grid" className="relative mt-4" />
      </section>

      <section>
        <h2 className="mb-2.5 px-1 text-xs font-extrabold tracking-[0.14em] text-slate-500 uppercase">
          {t.popularTitle}
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {SCHEME_SHORTCUTS.map(({ id, Icon, tone, name, topic, question }) => (
            <button
              key={id}
              type="button"
              disabled={busy}
              onClick={() => void askText(question[language])}
              className="group flex items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-soft ring-1 ring-ink/5 transition hover:-translate-y-0.5 hover:ring-leaf-400 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-leaf-600 active:scale-[0.98] disabled:opacity-60"
            >
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone}`}
              >
                <Icon aria-hidden className="size-6" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] leading-snug font-bold text-slate-800">
                  {name[language]}
                </span>
                <span className="block text-xs font-semibold text-slate-500">
                  {topic[language]}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-leaf-600 p-4 text-white">
        <h2 className="text-xs font-extrabold tracking-[0.14em] text-leaf-200 uppercase">
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
                <span className="text-xs leading-snug font-semibold text-leaf-50">{label}</span>
              </span>
              {index < 2 && (
                <ArrowRight aria-hidden className="mt-3.5 size-4 shrink-0 text-leaf-300" />
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
