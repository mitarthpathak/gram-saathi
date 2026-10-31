import { CirclePlay, House, type LucideIcon } from 'lucide-react';
import { m } from 'motion/react';
import { useEffect, useState, type MouseEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { PhoneMicIcon } from '@/components/brand/PhoneMicIcon';
import { preloadApp } from '@/features/app-shell/loaders';
import { APP_SURFACE_ID, type AppLocationState } from '@/features/app-shell/navigation';
import { rememberOpener } from '@/features/app-shell/opener';
import { HOW_IT_WORKS_ID } from '@/features/landing/sections';
import { cn } from '@/lib/cn';
import { useStrings } from '@/lib/i18n';
import { pressable, spring } from '@/lib/motion/easings';
import { scrollToTarget } from '@/lib/motion/smoothScroll';
import { appStrings } from './strings';

type Section = 'home' | 'how';

const MotionLink = m.create(Link);

/** "How it works" is active once its section reaches the upper half of the screen. */
function useActiveSection(): Section {
  const [active, setActive] = useState<Section>('home');
  useEffect(() => {
    const target = document.getElementById(HOW_IT_WORKS_ID);
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setActive(entry.isIntersecting || entry.boundingClientRect.top < 0 ? 'how' : 'home');
      },
      { rootMargin: '0px 0px -55% 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  return active;
}

/**
 * Floating frosted dock, always visible on the landing page: Home, How it works, and the one
 * primary action, Open app. On desktop the Open app pill morphs into the app's phone frame.
 */
export function Dock({ appOpen }: { appOpen: boolean }) {
  const t = useStrings(appStrings);
  const location = useLocation();
  const active = useActiveSection();
  const openState: AppLocationState = { backgroundLocation: location };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <nav
        aria-label={t.dockLabel}
        className="frosted pointer-events-auto flex items-center gap-1 rounded-full p-1.5 shadow-dock ring-1 ring-ink/[0.06]"
      >
        <DockLink
          href="#top"
          onSelect={() => scrollToTarget(0)}
          Icon={House}
          label={t.dockHome}
          active={active === 'home'}
        />
        <DockLink
          href={`#${HOW_IT_WORKS_ID}`}
          onSelect={() => scrollToTarget(`#${HOW_IT_WORKS_ID}`)}
          Icon={CirclePlay}
          label={t.dockHow}
          active={active === 'how'}
        />
        <MotionLink
          id="open-app"
          to="/app"
          state={openState}
          onClick={(event: MouseEvent<HTMLAnchorElement>) => rememberOpener(event.currentTarget)}
          onPointerEnter={preloadApp}
          onFocus={preloadApp}
          className="relative isolate ml-0.5 flex h-12 items-center gap-2 rounded-full pr-5 pl-4 text-[15px] font-bold whitespace-nowrap text-ink"
          {...pressable}
        >
          {!appOpen && (
            <m.span
              layoutId={APP_SURFACE_ID}
              aria-hidden
              className="absolute inset-0 -z-10 bg-marigold-400 shadow-marigold"
              style={{ borderRadius: 999 }}
              transition={spring}
            />
          )}
          <PhoneMicIcon className="size-5" />
          {t.openApp}
        </MotionLink>
      </nav>
    </div>
  );
}

interface DockLinkProps {
  href: string;
  onSelect: () => void;
  Icon: LucideIcon;
  label: string;
  active: boolean;
}

function DockLink({ href, onSelect, Icon, label, active }: DockLinkProps) {
  return (
    <m.a
      href={href}
      aria-current={active ? 'true' : undefined}
      onClick={(event) => {
        event.preventDefault();
        onSelect();
      }}
      className={cn(
        // Stacked (icon over a small label) on phones, side by side from 420px.
        'relative isolate flex h-12 min-w-12 flex-col items-center justify-center rounded-full px-3 text-[11px] leading-none font-semibold whitespace-nowrap transition-colors min-[420px]:flex-row min-[420px]:gap-2 min-[420px]:px-4 min-[420px]:text-[15px]',
        active ? 'text-ink' : 'text-ink-soft hover:text-ink',
      )}
      {...pressable}
    >
      {active && (
        <m.span
          layoutId="dock-indicator"
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full bg-leaf-100"
          transition={spring}
        />
      )}
      <Icon aria-hidden className="size-5 shrink-0" strokeWidth={active ? 2.4 : 2} />
      <span className="mt-1 max-[339px]:sr-only min-[420px]:mt-0">{label}</span>
    </m.a>
  );
}
