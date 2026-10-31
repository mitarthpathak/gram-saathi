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
      className="mt-2 flex items-center gap-2 rounded-full bg-paper p-1.5 pl-4 ring-1 ring-ink/10 transition focus-within:ring-2 focus-within:ring-leaf-500"
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
        className="min-h-11 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-ink-soft"
      />
      <button
        type="submit"
        aria-label={t.send}
        disabled={disabled || !question}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-leaf-600 text-white shadow-leaf transition hover:bg-leaf-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-leaf-600 active:scale-95 disabled:bg-paper-deep disabled:text-ink-mute disabled:shadow-none"
      >
        <Send aria-hidden className="size-5" />
      </button>
    </form>
  );
}
