import { Mic } from 'lucide-react';
import { m } from 'motion/react';
import type { MouseEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { PhoneMicIcon } from '@/components/brand/PhoneMicIcon';
import { Sparkle, Sun } from '@/components/art/doodles';
import { reveal } from '@/components/motion/reveal';
import { preloadApp } from '@/features/app-shell/loaders';
import type { AppLocationState } from '@/features/app-shell/navigation';
import { rememberOpener } from '@/features/app-shell/opener';
import { useStrings } from '@/lib/i18n';
import { useMotionTier } from '@/lib/motion/tier';
import { MascotButton } from '../MascotButton';
import { landingStrings } from '../strings';
import { Chapter } from './Chapter';
import { chapterStrings } from './strings';

/** Chapter 7: one big, friendly "Open app". */
export function FinalCta() {
  const t = useStrings(chapterStrings);
  const hero = useStrings(landingStrings);
  const tier = useMotionTier();
  const location = useLocation();
  const remember = (event: MouseEvent<HTMLAnchorElement>) => rememberOpener(event.currentTarget);

  return (
    <Chapter sky="dawn" labelledBy="cta-title" className="px-5 py-24 sm:px-8 lg:py-36">
      <m.div
        {...reveal(tier)}
        className="relative mx-auto flex max-w-4xl flex-col items-center text-center"
      >
        <Sun className="absolute -top-6 -left-2 w-20 opacity-80 sm:left-10" />
        <Sparkle className="absolute top-24 right-4 w-6 text-marigold-300 lively:animate-twinkle sm:right-16" />
        <div className="w-28">
          <MascotButton mood="wave" bubble="right" className="aspect-[120/150] w-full" />
        </div>
        <h2
          id="cta-title"
          className="mt-6 font-display text-[clamp(2.6rem,6.5vw,6rem)] leading-display font-extrabold tracking-display text-balance"
        >
          {t.ctaTitle}
        </h2>
        <p className="mt-4 text-xl text-ink-soft">{t.ctaText}</p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <Link
            to="/app"
            state={{ backgroundLocation: location } satisfies AppLocationState}
            onClick={remember}
            onPointerEnter={preloadApp}
            onFocus={preloadApp}
            className="inline-flex h-20 items-center gap-3 rounded-full bg-marigold-400 pr-10 pl-8 text-2xl font-extrabold text-ink shadow-marigold transition duration-200 ease-out-soft hover:-translate-y-1 hover:bg-marigold-300 active:translate-y-0 active:scale-[0.95]"
          >
            <PhoneMicIcon className="size-7" />
            {t.openApp}
          </Link>
          <Link
            to="/app"
            state={{ backgroundLocation: location, focusMic: true } satisfies AppLocationState}
            onClick={remember}
            onPointerEnter={preloadApp}
            className="inline-flex min-h-14 items-center gap-2.5 rounded-full px-6 text-lg font-bold text-leaf-600 ring-2 ring-leaf-600/25 transition hover:ring-leaf-600 active:scale-[0.96]"
          >
            <Mic aria-hidden className="size-5" />
            {hero.holdToSpeak}
          </Link>
        </div>
      </m.div>
    </Chapter>
  );
}
