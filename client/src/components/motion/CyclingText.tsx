import { AnimatePresence, m } from 'motion/react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { duration, ease } from '@/lib/motion/easings';
import { useMotionTier } from '@/lib/motion/tier';

export interface CyclingItem {
  key: string;
  text: string;
  /** BCP-47 language of `text`, for fonts and screen readers. */
  lang?: string;
}

interface CyclingTextProps {
  items: CyclingItem[];
  /** Read by screen readers instead of the changing words. */
  label: string;
  intervalMs?: number;
  paused?: boolean;
  className?: string;
}

/**
 * Swaps whole words in place. Every item is also rendered invisibly in the same grid cell, so
 * the box is always as wide and tall as the longest one: no layout shift, in any script.
 */
export function CyclingText({
  items,
  label,
  intervalMs = 2200,
  paused = false,
  className,
}: CyclingTextProps) {
  const tier = useMotionTier();
  const [index, setIndex] = useState(0);
  const current = items[index % items.length];
  const shift = tier === 'reduced' ? '0%' : '55%';

  useEffect(() => {
    if (paused || items.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % items.length), intervalMs);
    return () => window.clearInterval(timer);
  }, [paused, items.length, intervalMs]);

  return (
    <span className={cn('relative inline-grid align-baseline', className)}>
      <span className="sr-only">{label}</span>
      {items.map((item) => (
        <span key={item.key} aria-hidden lang={item.lang} className="invisible [grid-area:1/1]">
          {item.text}
        </span>
      ))}
      <AnimatePresence initial={false}>
        <m.span
          key={current.key}
          aria-hidden
          lang={current.lang}
          className="[grid-area:1/1]"
          initial={{ opacity: 0, y: shift }}
          animate={{ opacity: 1, y: '0%' }}
          exit={{ opacity: 0, y: `-${shift}` }}
          transition={{ duration: duration.base, ease: ease.out }}
        >
          {current.text}
        </m.span>
      </AnimatePresence>
    </span>
  );
}
