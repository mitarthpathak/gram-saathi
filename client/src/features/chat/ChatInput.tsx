import { Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
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
    <form onSubmit={submit} className="flex gap-2">
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
        className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-slate-300 bg-white px-3 text-lg focus:border-brand-600 focus:outline-none"
      />
      <Button type="submit" size="lg" disabled={disabled || !question} aria-label={t.send}>
        <Send aria-hidden className="size-6" />
      </Button>
    </form>
  );
}
