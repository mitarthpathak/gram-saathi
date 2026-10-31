import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const LINE_STAGGER = 0.09;
const LINE_DURATION = 0.7;

interface MaskedLinesProps {
  /** One entry per visual line. Never split Indic text further than words. */
  lines: { key: string; content: ReactNode; className?: string }[];
}

/**
 * Headline lines that rise out of padded masks, one after another. Pure CSS (see .line-mask /
 * .line-rise in index.css), so it plays from the prerendered first paint; the masks are removed
 * once the lines land, so nothing stays clipped. Reduced tier: the global rule stops it.
 */
export function MaskedLines({ lines }: MaskedLinesProps) {
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    const total = (lines.length - 1) * LINE_STAGGER + LINE_DURATION;
    const timer = window.setTimeout(() => setLanded(true), total * 1000 + 150);
    return () => window.clearTimeout(timer);
  }, [lines.length]);

  return lines.map(({ key, content, className }, index) => (
    <span key={key} className={cn('block', !landed && 'line-mask')}>
      <span
        className={cn('block', !landed && 'line-rise', className)}
        style={{ '--i': index } as CSSProperties}
      >
        {content}
      </span>
    </span>
  ));
}
