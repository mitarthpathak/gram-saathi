import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mascot } from '@/components/art/Mascot';
import { cn } from '@/lib/cn';
import { useStrings } from '@/lib/i18n';
import { GREETINGS, markIntroSeen } from './intro';
import { landingStrings } from './strings';

const STEP_MS = 200;
const LIFT_MS = GREETINGS.length * STEP_MS + 50;

interface IntroOverlayProps {
  /** The curtain starts to lift: the hero below starts its entrance. */
  onLift: () => void;
  /** The curtain is gone. */
  onDone: () => void;
}

/**
 * Once per session, under 1.2 s: नमस्ते / नमस्कार / வணக்கம் / Hello, then the curtain lifts.
 * The hero is already rendered underneath (so it does not delay LCP). Click, tap or any key skips.
 */
export function IntroOverlay({ onLift, onDone }: IntroOverlayProps) {
  const t = useStrings(landingStrings);
  const [index, setIndex] = useState(0);
  const [lifting, setLifting] = useState(false);
  const lifted = useRef(false);

  const lift = useCallback(() => {
    if (lifted.current) return;
    lifted.current = true;
    setLifting(true);
    onLift();
  }, [onLift]);
  const liftFromEffect = useEffectEvent(() => lift());

  useEffect(() => {
    markIntroSeen();
    const timers = GREETINGS.slice(1).map((_, step) =>
      window.setTimeout(() => setIndex(step + 1), (step + 1) * STEP_MS),
    );
    timers.push(window.setTimeout(() => liftFromEffect(), LIFT_MS));
    const onKey = () => liftFromEffect();
    window.addEventListener('keydown', onKey);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const greeting = GREETINGS[index];

  // Portalled to <body>: it must cover the dock, which sits outside the landing page's layers.
  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-paper',
        lifting && 'animate-curtain-up',
      )}
      onClick={() => lift()}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) onDone();
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,#ffe3c2,transparent_70%)]"
      />
      <Mascot mood="wave" className="relative w-24 animate-pop sm:w-28" />
      <p
        aria-hidden
        lang={greeting.lang}
        key={greeting.lang}
        className="relative animate-fade-up font-display text-[clamp(3.5rem,12vw,7.5rem)] leading-[1.25] font-extrabold text-ink"
      >
        {greeting.text}
      </p>
      <button
        type="button"
        onClick={() => lift()}
        className="absolute right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] min-h-12 rounded-full px-5 text-base font-bold text-ink-soft ring-1 ring-ink/15 hover:text-ink"
      >
        {t.skipIntro}
      </button>
    </div>,
    document.body,
  );
}
