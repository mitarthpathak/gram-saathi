import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

interface WaveformProps {
  /** Current level, 0 to 1 (polled every animation frame). */
  getLevel: () => number;
  bars?: number;
  className?: string;
}

/** Scrolling level meter. Updates the DOM directly, so it costs no React renders. */
export function Waveform({ getLevel, bars = 22, className }: WaveformProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const spans = Array.from(ref.current?.children ?? []) as HTMLElement[];
    const levels = new Array<number>(spans.length).fill(0);
    let frame = 0;
    let tick = 0;
    const draw = () => {
      // Shift every other frame: about half a second of history across the bars.
      if (tick++ % 2 === 0) {
        levels.push(getLevel());
        levels.shift();
        spans.forEach((span, index) => {
          span.style.transform = `scaleY(${0.18 + levels[index] * 0.82})`;
        });
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [getLevel, bars]);

  return (
    <div ref={ref} aria-hidden className={cn('flex h-7 items-center gap-[3px]', className)}>
      {Array.from({ length: bars }, (_, index) => (
        <span
          key={index}
          className="h-full w-[3px] origin-center scale-y-[0.18] rounded-full bg-marigold-500 transition-transform duration-75"
        />
      ))}
    </div>
  );
}
