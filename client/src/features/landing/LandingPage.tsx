import { lazy, Suspense, useState } from 'react';
import { Hero } from './hero/Hero';
import { HOW_IT_WORKS_ID } from './sections';
import { SiteHeader } from './SiteHeader';
import { SkyContext } from './sky';
import { SkyBackground, type Sky } from './SkyBackground';

const Chapters = lazy(() => import('./chapters/Chapters'));
const Footer = lazy(() =>
  import('./chapters/Chapters').then((module) => ({ default: module.Footer })),
);

interface LandingPageProps {
  /** The app covers the page: looping animations hold. */
  paused: boolean;
  /** The intro overlay (rendered by SiteShell) still covers the hero. */
  introActive: boolean;
}

/**
 * The scrollytelling landing page: the hero, then the chapters (a separate chunk) under a sky
 * that drifts from dawn to dusk.
 */
export function LandingPage({ paused, introActive }: LandingPageProps) {
  const [sky, setSky] = useState<Sky>('dawn');

  return (
    <SkyContext value={setSky}>
      <div className="relative isolate min-h-dvh overflow-x-clip">
        <SkyBackground sky={sky} />
        <SiteHeader />
        <main>
          <Hero introActive={introActive} paused={paused} />
          <div id={HOW_IT_WORKS_ID}>
            <Suspense fallback={<div className="min-h-[150vh]" />}>
              <Chapters paused={paused} />
            </Suspense>
          </div>
        </main>
        <Suspense>
          <Footer />
        </Suspense>
      </div>
    </SkyContext>
  );
}
