import { AnimatePresence, m } from 'motion/react';
import { useEffect, useState } from 'react';
import { Mascot, type MascotMood } from '@/components/art/Mascot';
import { cn } from '@/lib/cn';
import { useStrings } from '@/lib/i18n';
import { spring } from '@/lib/motion/easings';
import { useMotionTier } from '@/lib/motion/tier';
import { useSettings } from '@/lib/settings';
import { GREETINGS } from './intro';
import { landingStrings } from './strings';

interface MascotButtonProps {
  mood: MascotMood;
  className?: string;
  /** Which side of Saathi the speech bubble appears on. */
  bubble?: 'left' | 'right';
}

/** Saathi, tappable: every tap says hello in the next of the four languages. */
export function MascotButton({ mood, className, bubble = 'left' }: MascotButtonProps) {
  const t = useStrings(landingStrings);
  const tier = useMotionTier();
  const { language } = useSettings();
  const [greeting, setGreeting] = useState<number | null>(null);
  const first = Math.max(
    0,
    GREETINGS.findIndex((item) => item.lang === language),
  );

  useEffect(() => {
    if (greeting === null) return;
    const timer = window.setTimeout(() => setGreeting(null), 2400);
    return () => window.clearTimeout(timer);
  }, [greeting]);

  const said = greeting === null ? null : GREETINGS[greeting];

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        aria-label={t.mascotLabel}
        onClick={() => setGreeting((current) => (current === null ? first : (current + 1) % 4))}
        className="block size-full cursor-pointer rounded-[2rem] transition-transform duration-200 select-none active:scale-90"
      >
        <Mascot mood={said ? 'happy' : mood} followCursor={tier === 'full'} className="size-full" />
      </button>
      <span aria-live="polite" className="sr-only">
        {said ? `${said.text}!` : ''}
      </span>
      <AnimatePresence>
        {said && (
          <m.span
            key={said.lang}
            aria-hidden
            lang={said.lang}
            className={cn(
              'pointer-events-none absolute -top-3 rounded-2xl bg-white px-3.5 py-1.5 font-display text-xl leading-[1.3] font-extrabold whitespace-nowrap text-ink shadow-lift ring-1 ring-ink/5',
              bubble === 'left' ? 'right-[85%] rounded-br-md' : 'left-[85%] rounded-bl-md',
            )}
            initial={{ opacity: 0, scale: 0.6, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={spring}
          >
            {said.text}!
          </m.span>
        )}
      </AnimatePresence>
    </div>
  );
}
