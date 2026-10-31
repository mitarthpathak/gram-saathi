import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useSkyZone } from '../sky';
import type { Sky } from '../SkyBackground';

interface ChapterProps {
  sky: Sky;
  /** Id of the chapter's heading (for aria-labelledby). */
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

/** A landing-page chapter: a labelled section that sets the sky while it is on screen. */
export function Chapter({ sky, labelledBy, className, children }: ChapterProps) {
  const ref = useRef<HTMLElement>(null);
  useSkyZone(ref, sky);
  return (
    <section ref={ref} aria-labelledby={labelledBy} className={cn('relative', className)}>
      {children}
    </section>
  );
}

interface ChapterHeadingProps {
  id: string;
  eyebrow: string;
  title: string;
  text?: string;
  className?: string;
  /** On the dusk panel. */
  inverted?: boolean;
}

/** Eyebrow, display title and a short intro line. */
export function ChapterHeading({
  id,
  eyebrow,
  title,
  text,
  className,
  inverted,
}: ChapterHeadingProps) {
  return (
    <div className={className}>
      <p
        className={cn(
          'text-sm font-extrabold tracking-[0.14em] uppercase indic:tracking-normal',
          inverted ? 'text-marigold-300' : 'text-accent-strong',
        )}
      >
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-3 font-display text-[clamp(2.1rem,4.2vw,4rem)] leading-display font-extrabold tracking-display text-balance ta:text-[clamp(1.8rem,3.2vw,3.1rem)]"
      >
        {title}
      </h2>
      {text && (
        <p
          className={cn(
            'mt-4 max-w-xl text-[clamp(1.05rem,1.3vw,1.25rem)] leading-relaxed',
            inverted ? 'text-dusk-muted' : 'text-ink-soft',
          )}
        >
          {text}
        </p>
      )}
    </div>
  );
}
