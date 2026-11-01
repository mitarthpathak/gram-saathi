import { X } from 'lucide-react';
import { m } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useStrings } from '@/lib/i18n';
import { duration, ease, pressable, spring } from '@/lib/motion/easings';
import { useFocusTrap } from '@/lib/useFocusTrap';
import { APP_SURFACE_ID } from './navigation';
import { appShellStrings } from './strings';

const MARIGOLD = '#ffa826';
const BEZEL = '#26231f';

interface AppSheetProps {
  onClose: () => void;
  children: ReactNode;
}

/**
 * Desktop: the app in a phone frame, centred over the dimmed landing page and scaled to the
 * viewport height. Closes with the X button, Esc or a click on the backdrop.
 */
export function AppSheet({ onClose, children }: AppSheetProps) {
  const t = useStrings(appShellStrings);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1000] isolate flex items-center justify-center p-6">
      <m.div
        aria-hidden
        className="absolute inset-0 bg-[rgb(38_35_31/0.32)] full-motion:backdrop-blur-[6px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: duration.base, ease: ease.out }}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.appLabel}
        tabIndex={-1}
        className="relative aspect-[9/19.5] h-[min(48rem,calc(100dvh-4rem))] outline-none"
      >
        <m.div
          layoutId={APP_SURFACE_ID}
          aria-hidden
          className="absolute inset-0 shadow-[0_50px_100px_-30px_rgb(38_35_31/0.55)]"
          style={{ borderRadius: 56 }}
          initial={{ backgroundColor: MARIGOLD }}
          animate={{ backgroundColor: BEZEL }}
          exit={{ backgroundColor: MARIGOLD }}
          transition={{
            default: spring,
            backgroundColor: { duration: duration.base, ease: ease.out },
          }}
        />
        <m.div
          className="absolute inset-[0.55rem] overflow-hidden rounded-[3rem] bg-paper"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: duration.fast } }}
          transition={{ delay: 0.3, duration: duration.base, ease: ease.out }}
        >
          <div
            aria-hidden
            className="absolute top-2.5 left-1/2 z-30 h-7 w-[6.5rem] -translate-x-1/2 rounded-full bg-ink"
          />
          {children}
        </m.div>
        <m.button
          type="button"
          onClick={onClose}
          aria-label={t.closeApp}
          className="absolute top-0 -right-16 flex size-12 items-center justify-center rounded-full bg-paper text-ink shadow-lift ring-1 ring-ink/10"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1, transition: { delay: 0.3, ...spring } }}
          exit={{ opacity: 0, scale: 0.6, transition: { duration: duration.fast } }}
          whileHover={pressable.whileHover}
          whileTap={pressable.whileTap}
        >
          <X aria-hidden className="size-5" />
        </m.button>
      </div>
    </div>
  );
}
