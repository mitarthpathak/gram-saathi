import { Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useStrings } from '@/lib/i18n';
import { chatStrings } from './strings';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

/** Text fallback for people who prefer typing or cannot use the mic. */
export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const t = useStrings(chatStrings);
  const [text, setText] = useState('');
  const question = text.trim();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question || disabled) return;
    onSend(question);
    setText('');
  };

  return (
    <form
      onSubmit={submit}
      className="mt-2 flex items-center gap-2 rounded-full bg-cream-50 p-1.5 pl-4 ring-1 ring-brand-950/10 transition focus-within:ring-2 focus-within:ring-brand-500"
    >
      <label htmlFor="chat-question" className="sr-only">
        {t.inputLabel}
      </label>
      <input
        id="chat-question"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={t.inputPlaceholder}
        maxLength={1000}
        autoComplete="off"
        enterKeyHint="send"
        className="min-h-11 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-slate-400"
      />
      <button
        type="submit"
        aria-label={t.send}
        disabled={disabled || !question}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-soft transition hover:brightness-110 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:scale-95 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none"
      >
        <Send aria-hidden className="size-5" />
      </button>
    </form>
  );
}
