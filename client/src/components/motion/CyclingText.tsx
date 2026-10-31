import { AnimatePresence, m } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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
  /** Optional underline (absolutely positioned): it shrinks or grows to the current word. */
  underline?: ReactNode;
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
  underline,
  className,
}: CyclingTextProps) {
  const tier = useMotionTier();
  const [index, setIndex] = useState(0);
  const current = items[index % items.length];
  const shift = tier === 'reduced' ? '0%' : '55%';
  const boxRef = useRef<HTMLSpanElement>(null);
  const sizers = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (paused || items.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % items.length), intervalMs);
    return () => window.clearInterval(timer);
  }, [paused, items.length, intervalMs]);

  // Underline width follows the visible word (a scaleX transform; the box itself never moves).
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || !underline) return;
    const update = () => {
      const word = sizers.current[index % items.length];
      if (word && box.offsetWidth) {
        box.style.setProperty('--word-scale', String(word.offsetWidth / box.offsetWidth));
      }
    };
    update();
    void document.fonts?.ready.then(update);
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, [index, items.length, underline]);

  return (
    <span ref={boxRef} className={cn('relative inline-grid align-baseline', className)}>
      <span className="sr-only">{label}</span>
      {items.map((item, i) => (
        <span
          key={item.key}
          ref={(element) => {
            sizers.current[i] = element;
          }}
          aria-hidden
          lang={item.lang}
          className="invisible justify-self-start [grid-area:1/1]"
        >
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
      {underline && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 origin-left scale-x-[var(--word-scale,1)] transition-transform duration-500 ease-out-soft"
        >
          {underline}
        </span>
      )}
    </span>
  );
}
