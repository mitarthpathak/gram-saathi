import { useEffect } from 'react';
import { startSmoothScroll } from './smoothScroll';

/** Turns Lenis on while `enabled` (loaded on demand, so phones never download it). */
export function useSmoothScroll(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    void startSmoothScroll().then((cleanup) => {
      if (cancelled) cleanup();
      else stop = cleanup;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [enabled]);
}
