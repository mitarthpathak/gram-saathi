import { useEffect, useRef } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { LanguageSelector } from '@/features/language/LanguageSelector';
import { useStrings } from '@/lib/i18n';
import { MessageBubble } from './MessageBubble';
import { chatStrings } from './strings';
import { useChat } from './useChat';

/** The scrolling transcript: questions, answers with sources and fraud warnings. */
export function ChatWindow() {
  const { messages, busy } = useChat();
  const t = useStrings(chatStrings);
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
      {busy && <Spinner label={t.thinking} className="mt-4 text-lg text-slate-700" />}
      <div ref={endRef} />
    </div>
  );
}

function EmptyState() {
  const t = useStrings(chatStrings);
  const { askText, busy } = useChat();

  return (
    <div className="flex flex-col gap-5 py-2 text-center">
      <div>
        <h1 className="text-2xl font-bold text-balance">{t.emptyTitle}</h1>
        <p className="mt-2 text-lg text-slate-700">{t.emptyHint}</p>
      </div>
      <LanguageSelector variant="grid" />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold tracking-wide text-slate-600 uppercase">
          {t.examplesTitle}
        </p>
        {[t.example1, t.example2].map((example) => (
          <button
            key={example}
            type="button"
            disabled={busy}
            onClick={() => void askText(example)}
            className="min-h-12 rounded-xl border-2 border-dashed border-brand-600 px-4 py-2 text-left text-lg text-brand-900 hover:bg-brand-50"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
