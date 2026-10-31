import { useState } from 'react';
import { Hero } from './hero/Hero';
import { introSeen } from './intro';
import { IntroOverlay } from './IntroOverlay';
import { HOW_IT_WORKS_ID } from './sections';
import { SiteHeader } from './SiteHeader';
import { SkyBackground } from './SkyBackground';

type IntroStage = 'covering' | 'lifting' | 'gone';

/**
 * The scrollytelling landing page. `paused`: the app covers it, so looping animations hold.
 */
export function LandingPage({ paused }: { paused: boolean }) {
  // Decided once, on mount: the intro never plays when the page opens under the app.
  const [intro, setIntro] = useState<IntroStage>(() =>
    paused || introSeen() ? 'gone' : 'covering',
  );

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip">
      <SkyBackground sky="dawn" />
      <SiteHeader />
      <main>
        <Hero introActive={intro === 'covering'} paused={paused} />
        <section id={HOW_IT_WORKS_ID} className="min-h-dvh" />
      </main>
      {intro !== 'gone' && (
        <IntroOverlay onLift={() => setIntro('lifting')} onDone={() => setIntro('gone')} />
      )}
    </div>
  );
}
