import { LazyMotion, MotionConfig } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { useSettings } from '@/lib/settings';
import { duration, ease } from './easings';
import { MotionTierContext, type MotionTier } from './tier';
import { useMediaQuery } from './useMediaQuery';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
const ROOMY_QUERY = '(min-width: 64rem) and (hover: hover) and (pointer: fine)';

const loadFeatures = () => import('./features').then((module) => module.default);

/** Very small devices or Data Saver: treat even a big screen as Lite. */
function isLowEndDevice(): boolean {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return (
    (nav.hardwareConcurrency ?? 8) <= 2 ||
    (nav.deviceMemory ?? 8) <= 2 ||
    nav.connection?.saveData === true
  );
}

const LOW_END = typeof navigator !== 'undefined' && isLowEndDevice();

/**
 * Picks the motion tier, exposes it as `useMotionTier()` and as `data-motion` on <html> (for the
 * `calm:` / `lively:` / `full-motion:` CSS variants), and sets up Motion for the whole app.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  const { lowBandwidth } = useSettings();
  const prefersReduced = useMediaQuery(REDUCED_QUERY);
  const roomy = useMediaQuery(ROOMY_QUERY);
  const tier: MotionTier =
    prefersReduced || lowBandwidth ? 'reduced' : roomy && !LOW_END ? 'full' : 'lite';

  useEffect(() => {
    document.documentElement.dataset.motion = tier;
  }, [tier]);

  return (
    <MotionTierContext value={tier}>
      <LazyMotion features={loadFeatures} strict>
        <MotionConfig
          reducedMotion={tier === 'reduced' ? 'always' : 'never'}
          transition={{ duration: duration.base, ease: ease.out }}
        >
          {children}
        </MotionConfig>
      </LazyMotion>
    </MotionTierContext>
  );
}
