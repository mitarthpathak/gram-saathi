import { ArrowRight, Mic } from 'lucide-react';
import type { MouseEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { Village, WavyUnderline } from '@/components/art/doodles';
import { CyclingText, type CyclingItem } from '@/components/motion/CyclingText';
import { MaskedLines, type MaskedLinesState } from '@/components/motion/MaskedLines';
import { preloadApp } from '@/features/app-shell/loaders';
import type { AppLocationState } from '@/features/app-shell/navigation';
import { rememberOpener } from '@/features/app-shell/opener';
import { LANGUAGES } from '@/features/language/languages';
import { useStrings } from '@/lib/i18n';
import { scrollToTarget } from '@/lib/motion/smoothScroll';
import { useSettings } from '@/lib/settings';
import { useAfterFirstPaint } from '@/lib/useAfterFirstPaint';
import { HOW_IT_WORKS_ID } from '../sections';
import { landingStrings } from '../strings';
import { HeroArt } from './HeroArt';
import { LanguageChips } from './LanguageChips';

interface HeroProps {
  /** The intro overlay still covers the hero. */
  introActive: boolean;
  /** The app covers the page: hold the looping demo. */
  paused: boolean;
}

/** Seconds: the headline rises first, then everything else follows it in. */
const AFTER_HEADLINE = 0.45;

export function Hero({ introActive, paused }: HeroProps) {
  const t = useStrings(landingStrings);
  const { language } = useSettings();
  const location = useLocation();
  const painted = useAfterFirstPaint();

  // First paint shows the headline as-is (it is the LCP element); under the intro it then
  // tucks below its masks, and rises when the curtain lifts.
  const lineState: MaskedLinesState = introActive ? (painted ? 'hidden' : 'shown') : 'play';
  const enter = (extra: number) => ({
    animationDelay: `${AFTER_HEADLINE + extra}s`,
    animationPlayState: introActive ? 'paused' : 'running',
  });

  // The punctuation travels with each word, so it never floats away from a short one.
  const words: CyclingItem[] = [
    { key: 'word', text: `${t.heroWord}${t.heroLine3After}`, lang: language },
    ...LANGUAGES.map((option) => ({
      key: option.code,
      text: `${option.nativeName}${t.heroLine3After}`,
      lang: option.code,
    })),
  ];
  const speakState: AppLocationState = { backgroundLocation: location, focusMic: true };

  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="relative mx-auto grid max-w-[92rem] items-center gap-2 px-5 pt-28 pb-36 sm:px-8 lg:min-h-[max(100svh,46rem)] lg:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)] lg:gap-0 lg:px-[6vw] lg:pt-24 lg:pb-28"
    >
      <Village className="pointer-events-none absolute right-[-4vw] bottom-[13%] -z-10 w-[min(70rem,64vw)] opacity-75 [mask-image:linear-gradient(to_right,transparent,black_30%)] max-lg:bottom-[9%] max-lg:w-[150vw]" />

      <div className="relative z-10">
        <h1
          id="hero-title"
          className="font-display text-[clamp(2.6rem,4.9vw,5.5rem)] leading-display font-extrabold tracking-display text-ink ta:text-[clamp(2rem,3.6vw,4rem)]"
        >
          <MaskedLines
            state={lineState}
            lines={[
              { key: '1', content: t.heroLine1 },
              { key: '2', content: t.heroLine2 },
              {
                key: '3',
                className: 'text-accent',
                content: (
                  <>
                    {t.heroLine3Before}{' '}
                    <CyclingText
                      className="whitespace-nowrap"
                      items={words}
                      label={`${t.heroWord}${t.heroLine3After}`}
                      paused={introActive || paused}
                      intervalMs={2400}
                      underline={
                        <WavyUnderline className="absolute -bottom-[0.16em] -left-[0.04em] h-[0.3em] w-[calc(100%+0.1em)] animate-draw-x [animation-delay:0.75s]" />
                      }
                    />
                  </>
                ),
              },
            ]}
          />
        </h1>

        <p
          className="mt-7 max-w-[40rem] animate-fade-up text-[clamp(1.06rem,1.4vw,1.32rem)] leading-relaxed text-ink-soft"
          style={enter(0)}
        >
          {t.heroSub}
        </p>

        <div
          className="mt-9 flex animate-fade-up flex-wrap items-center gap-x-8 gap-y-4"
          style={enter(0.07)}
        >
          <Link
            to="/app"
            state={speakState}
            onClick={(event: MouseEvent<HTMLAnchorElement>) => rememberOpener(event.currentTarget)}
            onPointerEnter={preloadApp}
            onFocus={preloadApp}
            className="inline-flex h-[3.75rem] items-center gap-3 rounded-full bg-leaf-600 pr-8 pl-6 text-lg font-bold text-white shadow-leaf transition duration-200 ease-out-soft hover:-translate-y-0.5 hover:bg-leaf-700 active:translate-y-0 active:scale-[0.96]"
          >
            <Mic aria-hidden className="size-5" strokeWidth={2.4} />
            {t.holdToSpeak}
          </Link>
          <a
            href={`#${HOW_IT_WORKS_ID}`}
            onClick={(event) => {
              event.preventDefault();
              scrollToTarget(`#${HOW_IT_WORKS_ID}`);
            }}
            className="group inline-flex min-h-12 items-center gap-2 text-[17px] font-bold text-ink"
          >
            {t.seeHow}
            <ArrowRight
              aria-hidden
              className="size-5 transition-transform duration-200 group-hover:translate-x-1"
            />
          </a>
        </div>

        <LanguageChips className="mt-9 animate-fade-up" style={enter(0.14)} />
      </div>

      <HeroArt
        paused={paused || introActive}
        hold={introActive}
        delay={AFTER_HEADLINE}
        className="h-[clamp(28rem,150vw,40rem)] lg:h-[min(46rem,calc(100svh-7rem))]"
      />
    </section>
  );
}
