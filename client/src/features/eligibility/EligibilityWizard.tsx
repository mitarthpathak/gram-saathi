import type {
  EligibilityAnswerResponse,
  EligibilityAnswerValue,
  EligibilityProgress,
  EligibilityQuestion,
  EligibilityResult,
  EligibilityStartResponse,
} from '@gram-saathi/shared';
import { ClipboardCheck, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/useToast';
import { SpeakButton } from '@/features/voice/SpeakButton';
import { api } from '@/lib/api';
import { format, useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { QuestionInput } from './QuestionInput';
import { ResultCard } from './ResultCard';
import { eligibilityStrings } from './strings';

type Phase =
  | { name: 'intro' }
  | {
      name: 'question';
      question: EligibilityQuestion;
      step: number;
      progress?: EligibilityProgress;
    }
  | { name: 'results'; results: EligibilityResult[] };

/** Asks a few questions one at a time, then shows which schemes the user may qualify for. */
export function EligibilityWizard() {
  const t = useStrings(eligibilityStrings);
  const toast = useToast();
  const { language, sessionId } = useSettings();
  const [phase, setPhase] = useState<Phase>({ name: 'intro' });
  const [loading, setLoading] = useState(false);

  const load = async (
    call: () => Promise<EligibilityStartResponse | EligibilityAnswerResponse>,
    step: number,
  ) => {
    setLoading(true);
    try {
      const response = await call();
      if ('done' in response && response.done) {
        setPhase({ name: 'results', results: response.results });
      } else {
        setPhase({
          name: 'question',
          question: response.question,
          progress: response.progress,
          step,
        });
      }
    } catch {
      // Includes "session not found" after a server restart: starting over is the fix.
      toast.show(t.error, 'error');
      setPhase({ name: 'intro' });
    } finally {
      setLoading(false);
    }
  };

  const start = () => load(() => api.eligibilityStart({ sessionId, language }), 1);

  const answer = (question: EligibilityQuestion, step: number, value: EligibilityAnswerValue) =>
    load(
      () => api.eligibilityAnswer({ sessionId, questionId: question.id, answer: value }),
      step + 1,
    );

  if (phase.name === 'question') {
    const { question, step, progress } = phase;
    return (
      <div className="flex flex-col gap-6">
        <ProgressBar current={progress?.current ?? step} total={progress?.total} />
        <h1 className="text-2xl leading-snug font-bold">{question.text}</h1>
        <div>
          <SpeakButton text={question.text} language={language} />
        </div>
        <QuestionInput
          key={question.id}
          question={question}
          disabled={loading}
          onAnswer={(value) => void answer(question, step, value)}
        />
      </div>
    );
  }

  if (phase.name === 'results') {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{t.resultsTitle}</h1>
        <ul className="flex flex-col gap-3">
          {phase.results.map((result) => (
            <li key={result.schemeId}>
              <ResultCard result={result} />
            </li>
          ))}
        </ul>
        <p className="text-base text-slate-600">{t.disclaimer}</p>
        <Button size="lg" variant="secondary" disabled={loading} onClick={() => void start()}>
          <RotateCcw aria-hidden className="size-5" />
          {t.restart}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <ClipboardCheck aria-hidden className="size-16 text-brand-700" />
      <h1 className="text-2xl font-bold text-balance">{t.title}</h1>
      <p className="text-lg text-slate-700">{t.intro}</p>
      <Button size="xl" className="w-full" disabled={loading} onClick={() => void start()}>
        {t.start}
      </Button>
      <p className="text-base text-slate-600">{t.disclaimer}</p>
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total?: number }) {
  const t = useStrings(eligibilityStrings);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-semibold text-slate-600">
        {total ? format(t.progress, { current, total }) : format(t.progressUnknown, { current })}
      </p>
      {total && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={current}
          className="h-3 overflow-hidden rounded-full bg-slate-200"
        >
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${(current / total) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
