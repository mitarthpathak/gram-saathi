import { createContext, useContext, useEffect, type RefObject } from 'react';
import type { Sky } from './SkyBackground';

/** Chapters report the sky they want; LandingPage passes it to <SkyBackground>. */
export const SkyContext = createContext<(sky: Sky) => void>(() => undefined);

/** Sets the sky while `ref` crosses the middle of the viewport. */
export function useSkyZone(ref: RefObject<HTMLElement | null>, sky: Sky): void {
  const report = useContext(SkyContext);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) report(sky);
      },
      { rootMargin: '-49% 0px -49% 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, sky, report]);
}
