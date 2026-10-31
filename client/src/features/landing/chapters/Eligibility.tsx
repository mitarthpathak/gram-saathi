import {
  ArrowRight,
  Check,
  CircleCheck,
  CircleHelp,
  CircleMinus,
  RotateCcw,
  X,
} from 'lucide-react';
import { AnimatePresence, m, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import type { LanguageCode } from '@gram-saathi/shared';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { preloadApp } from '@/features/app-shell/loaders';
import type { AppLocationState } from '@/features/app-shell/navigation';
import { SCHEME_SHORTCUTS } from '@/features/chat/schemes';
import { cn } from '@/lib/cn';
import { format, useStrings } from '@/lib/i18n';
import { duration, ease, pressable, spring, stagger } from '@/lib/motion/easings';
import { useMotionTier } from '@/lib/motion/tier';
import { useSettings } from '@/lib/settings';
import { reveal } from '@/components/motion/reveal';
import { MascotButton } from '../MascotButton';
import { Chapter, ChapterHeading } from './Chapter';
import { chapterStrings } from './strings';

const QUESTIONS = ['q1', 'q2', 'q3'] as const;

/** Drag further than this (px) or flick faster than this (px/s) to answer by swiping. */
const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 600;

type Verdict = 'may' | 'check' | 'not';

/**
 * Mirrors the sample rules in data/eligibility (simplified): PM-KISAN needs farmland and no
 * income-tax payer; Atal Pension needs age 18-40 and no income-tax payer; PM-JAY depends on
 * SECC data, so the honest answer is "check your name".
 */
function verdicts([farmland, age18to40, taxPayer]: boolean[]): { id: string; verdict: Verdict }[] {
  return [
    { id: 'pm-kisan', verdict: farmland && !taxPayer ? 'may' : 'not' },
    { id: 'atal-pension-yojana', verdict: age18to40 && !taxPayer ? 'may' : 'not' },
    { id: 'ayushman-bharat-pmjay', verdict: 'check' },
  ];
}

const schemeName = (id: string, language: LanguageCode) =>
  SCHEME_SHORTCUTS.find((scheme) => scheme.id === id)?.name[language] ?? id;

/** Chapter 3: three swipeable yes/no cards, then a checklist that says "may qualify". */
export function Eligibility() {
  const t = useStrings(chapterStrings);
  const tier = useMotionTier();
  const location = useLocation();
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [direction, setDirection] = useState(1);
  const done = answers.length === QUESTIONS.length;

  const answer = (value: boolean) => {
    setDirection(value ? 1 : -1);
    setAnswers((current) => [...current, value]);
  };
  const openState: AppLocationState = { backgroundLocation: location };

  return (
    <Chapter sky="noon" labelledBy="elig-title" className="py-24 lg:py-36">
      <div className="mx-auto grid max-w-[92rem] items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-[6vw]">
        <m.div {...reveal(tier)}>
          <ChapterHeading
            id="elig-title"
            eyebrow={t.eligEyebrow}
            title={t.eligTitle}
            text={t.eligText}
          />
          <p className="mt-6 flex max-w-lg gap-2 text-[15px] leading-relaxed text-ink-soft">
            <CircleHelp aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-strong" />
            {t.eligNote}
          </p>
          <Link
            to="/app/eligibility"
            state={openState}
            onPointerEnter={preloadApp}
            className="group mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-base font-bold text-ink shadow-soft ring-1 ring-ink/10 transition hover:-translate-y-0.5 active:scale-[0.96]"
          >
            {t.openChecker}
            <ArrowRight
              aria-hidden
              className="size-5 transition-transform group-hover:translate-x-1"
            />
          </Link>
        </m.div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -top-20 right-2 w-20">
            <MascotButton mood={done ? 'happy' : 'thinking'} className="aspect-[120/150] w-full" />
          </div>
          {done ? (
            <Results answers={answers} onReset={() => setAnswers([])} />
          ) : (
            <>
              <p aria-live="polite" className="mb-3 text-sm font-extrabold text-accent-strong">
                {format(t.questionOf, { current: answers.length + 1, total: QUESTIONS.length })}
              </p>
              <div className="relative h-[19rem]">
                <AnimatePresence custom={direction}>
                  {QUESTIONS.slice(answers.length)
                    .map((key, depth) => (
                      <QuestionCard key={key} text={t[key]} depth={depth} onAnswer={answer} />
                    ))
                    .reverse()}
                </AnimatePresence>
              </div>
              <p className="mt-4 text-center text-sm text-ink-soft">{t.swipeHint}</p>
            </>
          )}
        </div>
      </div>
    </Chapter>
  );
}

interface QuestionCardProps {
  text: string;
  /** 0 = the card on top. */
  depth: number;
  onAnswer: (value: boolean) => void;
}

/** Answered cards fly off to the side they were answered on (AnimatePresence `custom`). */
const CARD_VARIANTS = {
  gone: (direction: number) => ({
    x: direction * 420,
    rotate: direction * 18,
    opacity: 0,
    transition: { duration: duration.base, ease: ease.out },
  }),
};

function QuestionCard({ text, depth, onAnswer }: QuestionCardProps) {
  const t = useStrings(chapterStrings);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-12, 12]);
  const yesHint = useTransform(x, [20, SWIPE_DISTANCE], [0, 1]);
  const noHint = useTransform(x, [-SWIPE_DISTANCE, -20], [1, 0]);
  const top = depth === 0;

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) onAnswer(true);
    else if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) onAnswer(false);
  };

  return (
    <m.div
      className={cn(
        'absolute inset-0 flex flex-col justify-between rounded-[1.75rem] bg-white p-6 shadow-lift ring-1 ring-ink/5',
        top ? 'cursor-grab touch-pan-y active:cursor-grabbing' : 'pointer-events-none',
      )}
      style={{ x, rotate, zIndex: 10 - depth }}
      variants={CARD_VARIANTS}
      initial={false}
      animate={{ scale: 1 - depth * 0.05, y: depth * 16 }}
      exit="gone"
      transition={spring}
      drag={top ? 'x' : false}
      dragSnapToOrigin
      dragElastic={0.85}
      onDragEnd={onDragEnd}
      aria-hidden={!top}
      inert={!top}
    >
      <m.span
        aria-hidden
        className="absolute top-5 right-5 rounded-full bg-leaf-100 px-3 py-1 text-sm font-extrabold text-leaf-600"
        style={{ opacity: yesHint }}
      >
        {t.yes}
      </m.span>
      <m.span
        aria-hidden
        className="absolute top-5 left-5 rounded-full bg-blush px-3 py-1 text-sm font-extrabold text-rose-700"
        style={{ opacity: noHint }}
      >
        {t.no}
      </m.span>
      <p className="mt-8 font-display text-[1.7rem] leading-[1.15] font-extrabold text-balance indic:leading-[1.35]">
        {text}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <m.button
          type="button"
          onClick={() => onAnswer(false)}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-paper-alt text-lg font-bold text-ink ring-1 ring-ink/10"
          {...pressable}
        >
          <X aria-hidden className="size-5" strokeWidth={3} />
          {t.no}
        </m.button>
        <m.button
          type="button"
          onClick={() => onAnswer(true)}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-leaf-600 text-lg font-bold text-white shadow-leaf"
          {...pressable}
        >
          <Check aria-hidden className="size-5" strokeWidth={3} />
          {t.yes}
        </m.button>
      </div>
    </m.div>
  );
}

const VERDICT_STYLE: Record<
  Verdict,
  { Icon: typeof CircleCheck; tone: string; label: 'mayQualify' | 'checkAtCsc' | 'probablyNot' }
> = {
  may: { Icon: CircleCheck, tone: 'text-leaf-600', label: 'mayQualify' },
  check: { Icon: CircleHelp, tone: 'text-accent-strong', label: 'checkAtCsc' },
  not: { Icon: CircleMinus, tone: 'text-ink-soft', label: 'probablyNot' },
};

function Results({ answers, onReset }: { answers: boolean[]; onReset: () => void }) {
  const t = useStrings(chapterStrings);
  const tier = useMotionTier();
  const { language } = useSettings();
  const results = verdicts(answers);
  const celebrate = tier !== 'reduced' && results.some((result) => result.verdict === 'may');

  return (
    <div className="relative rounded-[1.75rem] bg-white p-6 shadow-lift ring-1 ring-ink/5">
      {celebrate && <Confetti />}
      <h3 className="font-display text-2xl font-extrabold">{t.resultTitle}</h3>
      <ul className="mt-4 flex flex-col gap-3">
        {results.map(({ id, verdict }, index) => {
          const { Icon, tone, label } = VERDICT_STYLE[verdict];
          return (
            <m.li
              key={id}
              className="flex items-center gap-3 rounded-2xl bg-paper p-3.5 ring-1 ring-ink/5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.base, ease: ease.out, delay: 0.1 + index * stagger }}
            >
              <Icon aria-hidden className={cn('size-7 shrink-0', tone)} />
              <span className="min-w-0">
                <span className="block font-bold">{schemeName(id, language)}</span>
                <span className={cn('block text-[15px] font-semibold', tone)}>{t[label]}</span>
              </span>
            </m.li>
          );
        })}
      </ul>
      <m.button
        type="button"
        onClick={onReset}
        className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full px-4 font-bold text-ink ring-1 ring-ink/15"
        {...pressable}
      >
        <RotateCcw aria-hidden className="size-4" />
        {t.tryAgain}
      </m.button>
    </div>
  );
}

/** Twelve bits of paper, fixed angles (no randomness in render). */
const PIECES = Array.from({ length: 12 }, (_, index) => {
  const angle = (index / 12) * Math.PI * 2 + 0.3;
  const distance = 90 + (index % 3) * 30;
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance - 40,
    rotate: (index % 2 ? 1 : -1) * (120 + index * 20),
    color: ['#ffa826', '#4cb47f', '#ffc463', '#86d2a6', '#ffe2df', '#dcefff'][index % 6],
    round: index % 3 === 0,
  };
});

function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none absolute top-10 left-1/2">
      {PIECES.map((piece, index) => (
        <m.span
          key={index}
          className={cn('absolute size-2.5', piece.round ? 'rounded-full' : 'rounded-[2px]')}
          style={{ backgroundColor: piece.color }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.6, rotate: 0 }}
          animate={{ x: piece.x, y: piece.y, opacity: 0, scale: 1, rotate: piece.rotate }}
          transition={{ duration: 0.9, ease: ease.out, delay: 0.25 }}
        />
      ))}
    </div>
  );
}
