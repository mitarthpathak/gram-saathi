import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useMotionTier } from '@/lib/motion/tier';

/** Lines stagger a little wider than chips (still inside the 60-90 ms range). */
const LINE_STAGGER = 0.09;

interface MaskedLinesProps {
  /** One entry per visual line. Never split Indic text further than words. */
  lines: { key: string; content: ReactNode; className?: string }[];
  /** False holds the lines below their masks (e.g. while the intro covers the hero). */
  play?: boolean;
  /** Seconds before the first line rises. */
  delay?: number;
}

/**
 * Lines that rise out of padded masks, one after another (pure CSS, so it costs no JS frames).
 * The text is in the DOM and readable from the start; Reduced tier shows it without motion.
 */
export function MaskedLines({ lines, play = true, delay = 0 }: MaskedLinesProps) {
  const tier = useMotionTier();
  const animate = tier !== 'reduced';
  const [done, setDone] = useState(false);
  const total = delay + (lines.length - 1) * LINE_STAGGER + 0.7;

  // Drop the masks once everything has landed: nothing stays clipped at rest.
  useEffect(() => {
    if (!play || !animate) return;
    const timer = window.setTimeout(() => setDone(true), total * 1000 + 100);
    return () => window.clearTimeout(timer);
  }, [play, animate, total]);

  return lines.map(({ key, content, className }, index) => (
    <span key={key} className={cn(animate && !done && 'reveal-mask', 'block')}>
      <span
        className={cn(
          'block',
          animate && !done && (play ? 'animate-rise' : 'translate-y-[calc(100%+0.6em)]'),
          className,
        )}
        style={animate && play ? { animationDelay: `${delay + index * LINE_STAGGER}s` } : undefined}
      >
        {content}
      </span>
    </span>
  ));
}
