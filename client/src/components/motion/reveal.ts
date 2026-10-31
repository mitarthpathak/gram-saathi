import type { MotionProps } from 'motion/react';
import { duration, ease } from '@/lib/motion/easings';
import type { MotionTier } from '@/lib/motion/tier';

interface RevealOptions {
  delay?: number;
  /** Rise distance in px for the Full tier (Lite uses half, Reduced fades only). */
  y?: number;
  /** Play every time it enters the viewport instead of once. */
  repeat?: boolean;
}

/**
 * Props for a scroll-triggered entrance: spread them on any `m.*` element.
 * `<m.li {...reveal(tier, { delay: index * stagger })}>`
 */
export function reveal(
  tier: MotionTier,
  { delay = 0, y = 28, repeat = false }: RevealOptions = {},
) {
  const rise = tier === 'reduced' ? 0 : tier === 'lite' ? y / 2 : y;
  return {
    initial: { opacity: 0, y: rise },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: !repeat, margin: '0px 0px -12% 0px' },
    transition: { duration: duration.slow, ease: ease.out, delay },
  } satisfies MotionProps;
}
