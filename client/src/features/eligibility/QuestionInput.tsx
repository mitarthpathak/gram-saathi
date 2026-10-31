import type { EligibilityAnswerValue, EligibilityQuestion } from '@gram-saathi/shared';
import { Check, ChevronRight, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { useStrings } from '@/lib/i18n';
import { eligibilityStrings } from './strings';

interface QuestionInputProps {
  question: EligibilityQuestion;
  onAnswer: (answer: EligibilityAnswerValue) => void;
  disabled: boolean;
}

const TILE =
  'transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-leaf-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60';

/** Big answer controls for the three question types: number, choice and yes/no. */
export function QuestionInput({ question, onAnswer, disabled }: QuestionInputProps) {
  const t = useStrings(eligibilityStrings);

  switch (question.type) {
    case 'boolean':
      return (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(true)}
            className={`flex min-h-32 flex-col items-center justify-center gap-2 rounded-3xl bg-linear-to-br from-leaf-500 to-leaf-600 text-2xl font-extrabold text-white shadow-lift ${TILE}`}
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-white/20">
              <Check aria-hidden className="size-7" strokeWidth={3} />
            </span>
            {t.yes}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(false)}
            className={`flex min-h-32 flex-col items-center justify-center gap-2 rounded-3xl bg-white text-2xl font-extrabold text-slate-800 shadow-soft ring-2 ring-ink/10 hover:ring-leaf-400 ${TILE}`}
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-slate-100">
              <X aria-hidden className="size-7 text-slate-600" strokeWidth={3} />
            </span>
            {t.no}
          </button>
        </div>
      );
    case 'choice':
      return (
        <div className="flex flex-col gap-2.5">
          {(question.options ?? []).map((option) => (
            <button
              key={option}
              type="button"
              disabled={disabled}
              onClick={() => onAnswer(option)}
              className={`group flex min-h-16 items-center gap-3 rounded-2xl bg-white px-4 text-left text-lg font-bold text-slate-800 shadow-soft ring-1 ring-ink/5 hover:ring-2 hover:ring-leaf-500 ${TILE}`}
            >
              <span
                aria-hidden
                className="size-5 shrink-0 rounded-full ring-2 ring-leaf-300 transition group-hover:bg-leaf-500 group-hover:ring-leaf-500"
              />
              {option}
              <ChevronRight aria-hidden className="ml-auto size-5 shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      );
    case 'number':
      return <NumberAnswer onAnswer={onAnswer} disabled={disabled} />;
  }
}

function NumberAnswer({ onAnswer, disabled }: Omit<QuestionInputProps, 'question'>) {
  const t = useStrings(eligibilityStrings);
  const [value, setValue] = useState('');
  const number = value.trim() === '' ? Number.NaN : Number(value);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (Number.isFinite(number)) onAnswer(number);
  };

  return (
    <form onSubmit={submit} className="flex gap-3">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t.numberPlaceholder}
        aria-label={t.numberPlaceholder}
        className="min-h-16 w-full min-w-0 rounded-2xl bg-white px-5 text-3xl font-extrabold tracking-tight shadow-soft ring-2 ring-ink/10 placeholder:text-xl placeholder:font-semibold placeholder:text-slate-400 focus:ring-leaf-500 focus:outline-none"
      />
      <Button type="submit" size="xl" disabled={disabled || !Number.isFinite(number)}>
        {t.next}
      </Button>
    </form>
  );
}
