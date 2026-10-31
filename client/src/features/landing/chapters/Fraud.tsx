import { m, useInView } from 'motion/react';
import { useRef } from 'react';
import { FraudWarning } from '@/features/chat/FraudWarning';
import { cn } from '@/lib/cn';
import { useStrings } from '@/lib/i18n';
import { duration, ease, spring, stagger } from '@/lib/motion/easings';
import { useMotionTier } from '@/lib/motion/tier';
import { reveal } from '@/components/motion/reveal';
import { MascotButton } from '../MascotButton';
import { useDemoContent } from '../useDemoContent';
import { useSettings } from '@/lib/settings';
import { Chapter, ChapterHeading } from './Chapter';
import { chapterStrings } from './strings';

/** Chapter 4, at dusk: the shield draws itself and the scam messages get stamped out. */
export function Fraud() {
  const t = useStrings(chapterStrings);
  const tier = useMotionTier();
  const { language } = useSettings();
  const demo = useDemoContent();
  const fraudWarning = demo?.pmKisanExchange(language, true).response.fraudWarning;
  const shieldRef = useRef<HTMLDivElement>(null);
  const shieldInView = useInView(shieldRef, { once: true, amount: 0.6 });

  return (
    <Chapter sky="dusk" labelledBy="fraud-title" className="px-3 py-10 sm:px-5">
      <div className="relative isolate overflow-hidden rounded-[2.5rem] bg-dusk px-6 py-20 text-dusk-ink sm:px-10 lg:rounded-[3.5rem] lg:px-[6vw] lg:py-28">
        <Stars />
        <div className="relative grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div ref={shieldRef} className="mb-8 w-24 sm:w-28">
              <Shield drawn={shieldInView || tier === 'reduced'} />
            </div>
            <ChapterHeading
              id="fraud-title"
              inverted
              eyebrow={t.fraudEyebrow}
              title={t.fraudTitle}
              text={t.fraudText}
            />
            {fraudWarning && (
              <m.div {...reveal(tier, { delay: 0.2 })} className="mt-8 max-w-lg">
                <p className="mb-2 text-sm font-bold text-dusk-muted">{t.withEveryAnswer}</p>
                <FraudWarning text={fraudWarning} />
              </m.div>
            )}
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -top-[4.6rem] -right-1 w-20">
              <MascotButton mood="thinking" className="aspect-[120/150] w-full" />
            </div>
            <ul className="flex flex-col gap-5">
              {(['scam1', 'scam2'] as const).map((key, index) => (
                <ScamMessage key={key} text={t[key]} index={index} />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Chapter>
  );
}

function ScamMessage({ text, index }: { text: string; index: number }) {
  const t = useStrings(chapterStrings);
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.7 });
  const delay = 0.5 + index * 0.45;

  return (
    <li ref={ref} className="relative">
      <div className="rounded-[1.5rem] rounded-tl-md bg-dusk-soft p-5 ring-1 ring-dusk-line">
        <p className="text-sm font-bold text-dusk-muted">{t.unknownSender}</p>
        <p className="relative mt-1.5 text-lg leading-snug font-semibold">
          <span
            className={cn('transition-opacity duration-500', inView && 'opacity-60')}
            style={{ transitionDelay: `${delay}s` }}
          >
            {text}
          </span>
          {/* Struck through (drawn left to right with clip-path). */}
          <span
            aria-hidden
            className={cn(
              'absolute top-1/2 left-0 h-[3px] w-full -rotate-2 rounded-full bg-[#ff8a80]',
              inView ? 'animate-draw-x' : 'opacity-0',
            )}
            style={{ animationDelay: `${delay}s` }}
          />
        </p>
      </div>
      <m.span
        aria-hidden={!inView}
        className="absolute -right-2 -bottom-4 rounded-xl border-[3px] border-[#ff8a80] bg-dusk px-3 py-1 font-display text-xl font-extrabold tracking-wide text-[#ff8a80] uppercase indic:tracking-normal"
        initial={{ opacity: 0, scale: 2.2, rotate: -24 }}
        animate={inView ? { opacity: 1, scale: 1, rotate: -10 } : undefined}
        transition={{ ...spring, delay: delay + 0.15 }}
      >
        {t.stamp}
      </m.span>
    </li>
  );
}

/** A shield that draws itself top to bottom (clip-path), then gets its check mark. */
function Shield({ drawn }: { drawn: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 100 116" className="w-full overflow-visible">
      <path
        d="M50 6 88 20v30c0 28-16 48-38 60C28 98 12 78 12 50V20Z"
        fill="rgb(255 168 38 / 0.12)"
        stroke="#ffc463"
        strokeWidth="5"
        strokeLinejoin="round"
        className={drawn ? 'animate-draw-y' : '[clip-path:inset(0_0_100%_0)]'}
      />
      <path
        d="m33 58 12 12 23-26"
        fill="none"
        stroke="#ffc463"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={
          drawn ? 'animate-draw-x [animation-delay:0.55s]' : '[clip-path:inset(0_100%_0_0)]'
        }
      />
    </svg>
  );
}

/** A few fixed stars (no randomness in render). */
function Stars() {
  const stars = [
    [8, 14],
    [22, 8],
    [38, 18],
    [61, 6],
    [74, 15],
    [90, 9],
    [84, 30],
    [12, 42],
    [95, 55],
    [5, 78],
    [70, 88],
    [48, 92],
    [28, 84],
  ];
  return (
    <div aria-hidden className="absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_80%_0%,#4a3d75,transparent_70%)]" />
      {stars.map(([left, top], index) => (
        <span
          key={index}
          className="absolute size-1 rounded-full bg-[#f6f2ff] lively:animate-twinkle"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            animationDelay: `${-index * 0.37}s`,
            opacity: 0.6,
          }}
        />
      ))}
      <m.span
        className="absolute top-10 right-[12%] size-16 rounded-full bg-[#fff3c4] shadow-[0_0_60px_10px_rgb(255_243_196/0.35)]"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 0.9, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: duration.slow, ease: ease.out, delay: stagger }}
      />
    </div>
  );
}
