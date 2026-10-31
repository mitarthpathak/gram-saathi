import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useMotionTier } from '@/lib/motion/tier';

/** Lines stagger a little wider than chips (still inside the 60-90 ms range). */
const LINE_STAGGER = 0.09;
const LINE_DURATION = 0.7;

/**
 * - shown: plain text, no mask (first paint, so it counts for LCP).
 * - hidden: below the masks (while something covers the hero).
 * - play: rises into place, line by line.
 */
export type MaskedLinesState = 'shown' | 'hidden' | 'play';

interface MaskedLinesProps {
  /** One entry per visual line. Never split Indic text further than words. */
  lines: { key: string; content: ReactNode; className?: string }[];
  state?: MaskedLinesState;
  /** Seconds before the first line rises. */
  delay?: number;
}

/**
 * Lines that rise out of padded masks (pure CSS, so it costs no JS frames). The masks are
 * removed once the lines land, so nothing stays clipped. Reduced tier: plain text.
 */
export function MaskedLines({ lines, state = 'play', delay = 0 }: MaskedLinesProps) {
  const tier = useMotionTier();
  const [landed, setLanded] = useState(false);
  const masked = tier !== 'reduced' && state !== 'shown' && !landed;
  const total = delay + (lines.length - 1) * LINE_STAGGER + LINE_DURATION;

  useEffect(() => {
    if (state !== 'play' || tier === 'reduced') return;
    const timer = window.setTimeout(() => setLanded(true), total * 1000 + 80);
    return () => window.clearTimeout(timer);
  }, [state, tier, total]);

  return lines.map(({ key, content, className }, index) => (
    <span key={key} className={cn('block', masked && 'reveal-mask')}>
      <span
        className={cn(
          'block',
          masked && (state === 'play' ? 'animate-rise' : 'translate-y-[calc(100%+0.6em)]'),
          className,
        )}
        style={
          masked && state === 'play'
            ? { animationDelay: `${delay + index * LINE_STAGGER}s` }
            : undefined
        }
      >
        {content}
      </span>
    </span>
  ));
}
