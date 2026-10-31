import { useEffect, useRef, type CSSProperties } from 'react';
import { Mascot } from '@/components/art/Mascot';
import { useStrings } from '@/lib/i18n';
import { GREETINGS } from './intro';
import { landingStrings } from './strings';

interface IntroOverlayProps {
  /** The curtain has lifted (or was skipped): unmount. */
  onDone: () => void;
}

/**
 * Once per session, under 1.2 s: नमस्ते / नमस्कार / வணக்கம் / Hello, then the curtain lifts.
 * Pure CSS timing (index.css), so it plays from the prerendered first paint, over a hero that
 * is already rendered. Click, tap or any key skips. The head script in index.html hides it
 * when it already played this session.
 */
export function IntroOverlay({ onDone }: IntroOverlayProps) {
  const t = useStrings(landingStrings);
  const ref = useRef<HTMLDivElement>(null);
  const skip = (element: HTMLElement | null) => element?.setAttribute('data-skip', '');

  useEffect(() => {
    const onKey = () => ref.current?.setAttribute('data-skip', '');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      ref={ref}
      className="intro-overlay fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-paper"
      onClick={(event) => skip(event.currentTarget)}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) onDone();
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,#ffe3c2,transparent_70%)]"
      />
      <Mascot mood="wave" className="relative w-24 animate-pop sm:w-28" />
      <p aria-hidden className="relative grid">
        {GREETINGS.map(({ lang, text }, index) => (
          <span
            key={lang}
            lang={lang}
            className="intro-greeting text-center font-display text-[clamp(2.4rem,8.5vw,5.25rem)] leading-[1.25] font-extrabold text-ink [grid-area:1/1]"
            style={{ '--i': index } as CSSProperties}
          >
            {text}
          </span>
        ))}
      </p>
      <button
        type="button"
        onClick={(event) => skip(event.currentTarget.parentElement)}
        className="absolute right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] min-h-12 rounded-full px-5 text-base font-bold text-ink-soft ring-1 ring-ink/15 hover:text-ink"
      >
        {t.skipIntro}
      </button>
    </div>
  );
}
