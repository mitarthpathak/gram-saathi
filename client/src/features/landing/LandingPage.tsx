import { ArrowRight, Mic } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { preloadApp } from '@/features/app-shell/loaders';
import type { AppLocationState } from '@/features/app-shell/navigation';
import { useStrings } from '@/lib/i18n';
import { HOW_IT_WORKS_ID } from './sections';
import { SiteHeader } from './SiteHeader';
import { landingStrings } from './strings';

/** The scrollytelling landing page. `paused` = covered by the app: stop looping animations. */
export function LandingPage({ paused: _paused }: { paused: boolean }) {
  const t = useStrings(landingStrings);
  const location = useLocation();
  const speakState: AppLocationState = { backgroundLocation: location, focusMic: true };

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-paper">
      <SiteHeader />
      <section id="top" className="mx-auto max-w-[92rem] px-5 pt-32 pb-24 sm:px-8 lg:px-[6vw]">
        <h1 className="max-w-3xl font-display text-5xl leading-display font-extrabold tracking-display lg:text-7xl">
          {t.heroLine1} {t.heroLine2}{' '}
          <span className="text-accent">
            {t.heroLine3Before} {t.heroWord}
            {t.heroLine3After}
          </span>
        </h1>
        <p className="mt-6 text-lg text-ink-soft">{t.heroSub}</p>
        <div className="mt-8 flex flex-wrap items-center gap-5">
          <Link
            to="/app"
            state={speakState}
            onPointerEnter={preloadApp}
            className="inline-flex min-h-14 items-center gap-2.5 rounded-full bg-leaf-600 px-7 text-lg font-bold text-white shadow-leaf"
          >
            <Mic aria-hidden className="size-5" />
            {t.holdToSpeak}
          </Link>
          <a
            href={`#${HOW_IT_WORKS_ID}`}
            className="inline-flex min-h-12 items-center gap-2 font-bold"
          >
            {t.seeHow}
            <ArrowRight aria-hidden className="size-5" />
          </a>
        </div>
      </section>
      <section id={HOW_IT_WORKS_ID} className="min-h-dvh bg-paper-alt" />
    </div>
  );
}
