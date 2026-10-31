import { AnimatePresence } from 'motion/react';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useLocation, useOutlet } from 'react-router';
import { preloadApp } from '@/features/app-shell/loaders';
import { isAppPath, type AppLocationState } from '@/features/app-shell/navigation';
import { restoreOpenerFocus } from '@/features/app-shell/opener';
import { introAlreadyPlayed, markIntroSeen } from '@/features/landing/intro';
import { IntroOverlay } from '@/features/landing/IntroOverlay';
import { LandingPage } from '@/features/landing/LandingPage';
import { cn } from '@/lib/cn';
import { setScrollLocked } from '@/lib/motion/smoothScroll';
import { useMotionTier } from '@/lib/motion/tier';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/motion/useMediaQuery';
import { useSmoothScroll } from '@/lib/motion/useSmoothScroll';
import { Dock } from './Dock';

const noSubscription = () => () => undefined;

/** Keeps the exiting app mounted (with its old route) while it animates out. */
function Presence({ children }: { children: ReactNode }) {
  return children;
}

/**
 * The page frame. "/" is the landing page; "/app/*" is the app, which on desktop is a route
 * modal over the landing page (backgroundLocation pattern) and on phones is full screen.
 */
export function SiteShell() {
  const location = useLocation();
  const outlet = useOutlet();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const tier = useMotionTier();
  const inApp = isAppPath(location.pathname);
  const fromLanding = Boolean((location.state as AppLocationState | null)?.backgroundLocation);
  // Desktop always shows the landing behind the app (also when /app is opened directly);
  // phones keep it mounted underneath only when the app was opened from it.
  const landingMounted = location.pathname === '/' || (inApp && (isDesktop || fromLanding));
  const covered = inApp && landingMounted;

  // The intro is in the prerendered HTML and runs on CSS alone; React only removes it when done.
  // (The head script in index.html hides it when it already played or the page is not "/".)
  const played = useSyncExternalStore(noSubscription, introAlreadyPlayed, () => false);
  const [introDone, setIntroDone] = useState(false);
  const intro = !played && !introDone;
  useEffect(() => {
    if (!played) markIntroSeen();
  }, [played]);

  useSmoothScroll(tier === 'full' && landingMounted);

  useEffect(() => {
    setScrollLocked(covered);
    return () => setScrollLocked(false);
  }, [covered]);

  // Back on the landing page: focus returns to the button that opened the app.
  const wasInApp = useRef(inApp);
  useEffect(() => {
    if (wasInApp.current && !inApp) restoreOpenerFocus();
    wasInApp.current = inApp;
  }, [inApp]);

  // Fetch the app's code while the visitor reads the landing page.
  useEffect(() => {
    if (!landingMounted) return;
    const idle =
      window.requestIdleCallback ?? ((callback: () => void) => setTimeout(callback, 2000));
    idle(() => preloadApp());
  }, [landingMounted]);

  if (!landingMounted && !inApp) return outlet;

  return (
    <>
      {landingMounted && (
        <div
          inert={covered}
          className={cn(
            // Phones: once the app has slid over it, stop painting the landing page.
            covered && !isDesktop && 'invisible transition-[visibility] delay-[600ms]',
          )}
        >
          <LandingPage paused={covered} introActive={intro} />
          <Dock appOpen={covered && isDesktop} />
        </div>
      )}
      {landingMounted && intro && <IntroOverlay onDone={() => setIntroDone(true)} />}
      <AnimatePresence>
        {inApp && outlet && <Presence key="app">{outlet}</Presence>}
      </AnimatePresence>
    </>
  );
}
