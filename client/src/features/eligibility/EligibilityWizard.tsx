import type {
  EligibilityAnswerResponse,
  EligibilityAnswerValue,
  EligibilityProgress,
  EligibilityQuestion,
  EligibilityResult,
  EligibilityStartResponse,
} from '@gram-saathi/shared';
import {
  ArrowRight,
  Clock,
  HeartPulse,
  Info,
  PartyPopper,
  PiggyBank,
  RotateCcw,
  ShieldPlus,
  Wheat,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/useToast';
import { useChat } from '@/features/chat/useChat';
import { SpeakButton } from '@/features/voice/SpeakButton';
import { ApiError, api } from '@/lib/api';
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

const INTRO_ICONS = [
  { Icon: Wheat, tone: 'text-leaf-600' },
  { Icon: HeartPulse, tone: 'text-rose-600' },
  { Icon: PiggyBank, tone: 'text-marigold-600' },
  { Icon: ShieldPlus, tone: 'text-sky-700' },
];

/** Asks a few questions one at a time, then shows which schemes the user may qualify for. */
export function EligibilityWizard() {
  const t = useStrings(eligibilityStrings);
  const toast = useToast();
  const navigate = useNavigate();
  const { askText } = useChat();
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
    } catch (error) {
      const code = error instanceof ApiError ? error.code : '';
      if (code === 'SESSION_NOT_FOUND') {
        // The server restarted (sessions live in memory): starting over is the fix.
        toast.show(t.errorExpired, 'error');
        setPhase({ name: 'intro' });
      } else {
        // Stay on the same question so the user can simply answer again.
        const unclear = code === 'UNCLEAR_ANSWER' || code === 'INVALID_ANSWER';
        toast.show(unclear ? t.errorUnclear : t.error, 'error');
      }
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

  const askAbout = (schemeName: string) => {
    void navigate('/');
    void askText(format(t.askAboutQuestion, { scheme: schemeName }));
  };

  if (phase.name === 'question') {
    const { question, step, progress } = phase;
    return (
      <div key={question.id} className="flex animate-fade-up flex-col gap-5">
        <ProgressBar current={progress?.current ?? step} total={progress?.total} />
        <div className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
          <h1 className="text-2xl leading-snug font-extrabold tracking-tight text-slate-900">
            {question.text}
          </h1>
          <div className="mt-3">
            <SpeakButton text={question.text} language={language} />
          </div>
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
    const eligible = phase.results.filter((result) => result.eligible).length;
    const summary =
      eligible === 0
        ? t.summaryNone
        : eligible === 1
          ? t.summaryOne
          : format(t.summaryMany, { count: eligible });
    return (
      <div className="flex animate-fade-up flex-col gap-4">
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-leaf-600 to-leaf-600 p-5 text-white shadow-lift">
          <div aria-hidden className="absolute inset-0 bg-kolam opacity-50" />
          <PartyPopper aria-hidden className="relative size-9 text-marigold-300" />
          <h1 className="relative mt-3 text-sm font-extrabold tracking-[0.12em] text-leaf-200 uppercase">
            {t.resultsTitle}
          </h1>
          <p className="relative mt-1 text-2xl leading-tight font-extrabold">{summary}</p>
          <p className="relative mt-2 text-base text-leaf-100">{t.resultsHint}</p>
        </section>
        <ul className="flex flex-col gap-3">
          {phase.results.map((result) => (
            <li key={result.schemeId}>
              <ResultCard result={result} onAsk={askAbout} />
            </li>
          ))}
        </ul>
        <p className="flex gap-2 text-sm text-slate-600">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t.disclaimer}
        </p>
        <Button size="lg" variant="secondary" disabled={loading} onClick={() => void start()}>
          <RotateCcw aria-hidden className="size-5" />
          {t.restart}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex animate-fade-up flex-col gap-5">
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-leaf-600 to-ink p-6 text-white shadow-lift">
        <div aria-hidden className="absolute inset-0 bg-kolam opacity-50" />
        <div
          aria-hidden
          className="absolute -right-10 -bottom-12 size-44 rounded-full bg-marigold-400/25 blur-2xl"
        />
        <div aria-hidden className="relative flex -space-x-2.5">
          {INTRO_ICONS.map(({ Icon, tone }) => (
            <span
              key={tone}
              className="flex size-12 items-center justify-center rounded-full bg-white shadow-soft ring-4 ring-leaf-600"
            >
              <Icon className={`size-6 ${tone}`} />
            </span>
          ))}
        </div>
        <h1 className="relative mt-5 text-[1.7rem] leading-tight font-extrabold tracking-tight text-balance">
          {t.title}
        </h1>
        <p className="relative mt-2 text-lg text-leaf-100">{t.intro}</p>
        <p className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-bold ring-1 ring-white/20">
          <Clock aria-hidden className="size-4" />
          {t.duration}
        </p>
      </section>
      <Button size="xl" className="w-full" disabled={loading} onClick={() => void start()}>
        {t.start}
        <ArrowRight aria-hidden className="size-6" />
      </Button>
      <p className="flex gap-2 text-sm text-slate-600">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t.disclaimer}
      </p>
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total?: number }) {
  const t = useStrings(eligibilityStrings);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-extrabold tracking-wide text-leaf-600">
        {total ? format(t.progress, { current, total }) : format(t.progressUnknown, { current })}
      </p>
      {total && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={current}
          className="h-2.5 overflow-hidden rounded-full bg-leaf-100"
        >
          <div
            className="h-full rounded-full bg-linear-to-r from-leaf-400 to-leaf-600 transition-all duration-500"
            style={{ width: `${(current / total) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
