import { lazy, Suspense, useState } from 'react';
import { Hero } from './hero/Hero';
import { introSeen } from './intro';
import { IntroOverlay } from './IntroOverlay';
import { HOW_IT_WORKS_ID } from './sections';
import { SiteHeader } from './SiteHeader';
import { SkyContext } from './sky';
import { SkyBackground, type Sky } from './SkyBackground';

const Chapters = lazy(() => import('./chapters/Chapters'));
const Footer = lazy(() =>
  import('./chapters/Chapters').then((module) => ({ default: module.Footer })),
);

type IntroStage = 'covering' | 'lifting' | 'gone';

/**
 * The scrollytelling landing page: the hero, then the chapters (a separate chunk) under a sky
 * that drifts from dawn to dusk. `paused`: the app covers it, so looping animations hold.
 */
export function LandingPage({ paused }: { paused: boolean }) {
  // Decided once, on mount: the intro never plays when the page opens under the app.
  const [intro, setIntro] = useState<IntroStage>(() =>
    paused || introSeen() ? 'gone' : 'covering',
  );
  const [sky, setSky] = useState<Sky>('dawn');

  return (
    <SkyContext value={setSky}>
      <div className="relative isolate min-h-dvh overflow-x-clip">
        <SkyBackground sky={sky} />
        <SiteHeader />
        <main>
          <Hero introActive={intro === 'covering'} paused={paused} />
          <div id={HOW_IT_WORKS_ID}>
            <Suspense fallback={<div className="min-h-[150vh]" />}>
              <Chapters paused={paused} />
            </Suspense>
          </div>
        </main>
        <Suspense>
          <Footer />
        </Suspense>
        {intro !== 'gone' && (
          <IntroOverlay onLift={() => setIntro('lifting')} onDone={() => setIntro('gone')} />
        )}
      </div>
    </SkyContext>
  );
}
