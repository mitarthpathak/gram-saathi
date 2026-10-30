import type { EligibilityAnswerValue, EligibilityQuestion } from '@gram-saathi/shared';
import { Check, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { useStrings } from '@/lib/i18n';
import { eligibilityStrings } from './strings';

interface QuestionInputProps {
  question: EligibilityQuestion;
  onAnswer: (answer: EligibilityAnswerValue) => void;
  disabled: boolean;
}

/** Big answer controls for the three question types: number, choice and yes/no. */
export function QuestionInput({ question, onAnswer, disabled }: QuestionInputProps) {
  const t = useStrings(eligibilityStrings);

  switch (question.type) {
    case 'boolean':
      return (
        <div className="grid grid-cols-2 gap-3">
          <Button size="xl" disabled={disabled} onClick={() => onAnswer(true)}>
            <Check aria-hidden className="size-7" />
            {t.yes}
          </Button>
          <Button size="xl" variant="secondary" disabled={disabled} onClick={() => onAnswer(false)}>
            <X aria-hidden className="size-7" />
            {t.no}
          </Button>
        </div>
      );
    case 'choice':
      return (
        <div className="flex flex-col gap-3">
          {(question.options ?? []).map((option) => (
            <Button
              key={option}
              size="lg"
              variant="secondary"
              disabled={disabled}
              onClick={() => onAnswer(option)}
              className="justify-start text-left"
            >
              {option}
            </Button>
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
        className="min-h-16 w-full min-w-0 rounded-xl border-2 border-slate-300 px-4 text-2xl font-semibold focus:border-brand-600 focus:outline-none"
      />
      <Button type="submit" size="xl" disabled={disabled || !Number.isFinite(number)}>
        {t.next}
      </Button>
    </form>
  );
}
