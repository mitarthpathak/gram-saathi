import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PhoneFrameProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Adds a back plate behind the bezel so the phone shows an edge when tilted in 3D. */
  depth?: boolean;
}

/**
 * A slim-bezel phone in plain HTML/CSS: 380 x 780 px with a 360 px wide screen, so whatever
 * renders inside looks exactly like the app on a real phone. Scale it with a transform.
 */
export function PhoneFrame({ children, className, style, depth = false }: PhoneFrameProps) {
  return (
    <div
      className={cn(
        'relative h-[780px] w-[380px] rounded-[3.4rem] [transform-style:preserve-3d]',
        className,
      )}
      style={style}
    >
      {depth && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-[3.4rem] bg-[#5b544a]"
          style={{ transform: 'translateZ(-16px)' }}
        />
      )}
      <div className="absolute inset-0 rounded-[3.4rem] bg-ink p-[10px] shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.12),inset_0_0_0_5px_rgb(0_0_0/0.35)]">
        <span
          aria-hidden
          className="absolute top-36 -left-[3px] h-14 w-[3px] rounded-l bg-[#4a443c]"
        />
        <span
          aria-hidden
          className="absolute top-56 -left-[3px] h-20 w-[3px] rounded-l bg-[#4a443c]"
        />
        <span
          aria-hidden
          className="absolute top-44 -right-[3px] h-24 w-[3px] rounded-r bg-[#4a443c]"
        />
        <div className="relative h-full overflow-hidden rounded-[2.75rem] bg-paper">
          <div
            aria-hidden
            className="absolute top-3 left-1/2 z-30 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-ink"
          />
          {children}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-30 bg-linear-to-br from-white/25 via-white/0 to-white/0"
          />
        </div>
      </div>
    </div>
  );
}
