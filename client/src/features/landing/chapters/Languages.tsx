import type { LanguageCode } from '@gram-saathi/shared';
import { BadgeCheck } from 'lucide-react';
import { AnimatePresence, m, useScroll, useSpring, useTransform, useVelocity } from 'motion/react';
import { useState } from 'react';
import { Sparkle } from '@/components/art/doodles';
import { reveal } from '@/components/motion/reveal';
import { LANGUAGES } from '@/features/language/languages';
import { SpeakButton } from '@/features/voice/SpeakButton';
import { cn } from '@/lib/cn';
import { useStrings } from '@/lib/i18n';
import { duration, ease } from '@/lib/motion/easings';
import { useMotionTier } from '@/lib/motion/tier';
import { useSettings } from '@/lib/settings';
import { MascotButton } from '../MascotButton';
import { useDemoContent } from '../useDemoContent';
import { Chapter, ChapterHeading } from './Chapter';
import { chapterStrings } from './strings';

/** Chapter 5: a huge marquee of the four languages, and the same answer in each of them. */
export function Languages({ paused }: { paused: boolean }) {
  const t = useStrings(chapterStrings);
  const tier = useMotionTier();
  const { language } = useSettings();
  const demo = useDemoContent();
  const [picked, setPicked] = useState<LanguageCode>(language);
  const sample = demo?.pmKisanExchange(picked);

  return (
    <Chapter sky="dawn" labelledBy="lang-title" className="overflow-x-clip py-24 lg:py-36">
      <m.div {...reveal(tier)} className="mx-auto max-w-[92rem] px-5 sm:px-8 lg:px-[6vw]">
        <ChapterHeading
          id="lang-title"
          eyebrow={t.langEyebrow}
          title={t.langTitle}
          text={t.langText}
        />
      </m.div>

      <Marquee paused={paused} />

      <div className="mx-auto grid max-w-[92rem] items-start gap-8 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:px-[6vw]">
        <div className="relative">
          <div
            role="radiogroup"
            aria-label={t.langPick}
            className="grid grid-cols-2 gap-3 sm:max-w-sm"
          >
            {LANGUAGES.map((option) => {
              const selected = option.code === picked;
              return (
                <button
                  key={option.code}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  lang={option.code}
                  onClick={() => setPicked(option.code)}
                  className={cn(
                    'min-h-16 rounded-[1.4rem] px-4 font-display text-2xl leading-[1.3] font-extrabold transition duration-200 active:scale-95',
                    selected
                      ? 'bg-leaf-600 text-white shadow-leaf'
                      : 'bg-white text-ink shadow-soft ring-1 ring-ink/5 hover:-translate-y-0.5',
                  )}
                >
                  {option.nativeName}
                </button>
              );
            })}
          </div>
          <div className="mt-8 hidden w-24 lg:block">
            <MascotButton mood="happy" bubble="right" className="aspect-[120/150] w-full" />
          </div>
        </div>

        <div className="relative min-h-[22rem]">
          <AnimatePresence mode="wait" initial={false}>
            {sample && (
              <m.article
                key={picked}
                lang={picked}
                aria-live="polite"
                className="rounded-[2rem] bg-white p-6 shadow-lift ring-1 ring-ink/5 sm:p-8"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: duration.base, ease: ease.out }}
              >
                <p className="text-sm font-bold text-ink-soft">{t.sampleQuestion}</p>
                <p className="mt-1 font-display text-2xl leading-snug font-extrabold indic:leading-[1.4]">
                  {sample.question}
                </p>
                <p className="mt-5 text-lg leading-relaxed text-ink">{sample.response.answer}</p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <SpeakButton text={sample.response.answer} language={picked} />
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-leaf-600">
                    <BadgeCheck aria-hidden className="size-4" />
                    {sample.response.sources[0]?.schemeName} · {sample.response.sources[0]?.section}
                  </span>
                </div>
              </m.article>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Chapter>
  );
}

/** The four names, sliding forever; leaning into the scroll direction in the Full tier. */
function Marquee({ paused }: { paused: boolean }) {
  const tier = useMotionTier();
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smooth = useSpring(velocity, { damping: 40, stiffness: 260 });
  const skewX = useTransform(smooth, [-3000, 0, 3000], [14, 0, -14], { clamp: true });
  const run = [...LANGUAGES, ...LANGUAGES];

  return (
    <div aria-hidden className="my-14 overflow-hidden py-4 lg:my-20">
      <m.div style={{ skewX: tier === 'full' ? skewX : 0 }}>
        <div
          className={cn(
            'flex w-max lively:animate-marquee',
            paused && '[animation-play-state:paused]',
          )}
        >
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center">
              {run.map((option, index) => (
                <span key={`${copy}-${index}`} className="flex items-center">
                  <span
                    lang={option.code}
                    className={cn(
                      'px-[0.35em] font-display text-[clamp(3.6rem,10vw,9.5rem)] leading-[1.35] font-extrabold whitespace-nowrap',
                      index % 2 ? 'text-accent' : 'text-ink',
                    )}
                  >
                    {option.nativeName}
                  </span>
                  <Sparkle className="w-[clamp(1.5rem,3vw,3rem)] shrink-0 text-marigold-400" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </m.div>
    </div>
  );
}
