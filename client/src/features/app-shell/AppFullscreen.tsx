import { m } from 'motion/react';
import { useRef, type ReactNode } from 'react';
import { useStrings } from '@/lib/i18n';
import { ease } from '@/lib/motion/easings';
import { useMotionTier } from '@/lib/motion/tier';
import { useFocusTrap } from '@/lib/useFocusTrap';
import { appShellStrings } from './strings';

interface AppFullscreenProps {
  /** Opened over the landing page (slides up, behaves as a dialog). */
  overLanding: boolean;
  children: ReactNode;
}

/** Phones: the app full screen, no frame. Slides up over the landing page. */
export function AppFullscreen({ overLanding, children }: AppFullscreenProps) {
  const t = useStrings(appShellStrings);
  const tier = useMotionTier();
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, overLanding);
  const hidden = tier === 'reduced' ? { opacity: 0 } : { y: '100%' };

  return (
    <m.div
      ref={ref}
      role={overLanding ? 'dialog' : undefined}
      aria-modal={overLanding || undefined}
      aria-label={overLanding ? t.appLabel : undefined}
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-paper shadow-[0_-24px_48px_-24px_rgb(38_35_31/0.3)] outline-none"
      initial={overLanding ? hidden : false}
      animate={{ y: 0, opacity: 1 }}
      exit={hidden}
      transition={{ duration: 0.55, ease: ease.out }}
    >
      {children}
    </m.div>
  );
}
