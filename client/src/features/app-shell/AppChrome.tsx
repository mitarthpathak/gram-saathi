import { ClipboardCheck, MessageCircle, Smartphone, X } from 'lucide-react';
import { m } from 'motion/react';
import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { Badge } from '@/components/ui/Badge';
import { ToastViewport } from '@/components/ui/Toast';
import { LanguageSelector } from '@/features/language/LanguageSelector';
import { cn } from '@/lib/cn';
import { config } from '@/lib/config';
import { useStrings } from '@/lib/i18n';
import { pressable, spring } from '@/lib/motion/easings';
import { useSettings } from '@/lib/settings';
import { carryAppState } from './navigation';
import { appShellStrings } from './strings';
import { useServerStatus } from './useServerStatus';

const TABS = [
  { to: '/app', label: 'navAsk', Icon: MessageCircle },
  { to: '/app/eligibility', label: 'navEligibility', Icon: ClipboardCheck },
  { to: '/app/sms', label: 'navSms', Icon: Smartphone },
] as const;

interface AppChromeProps {
  /** Shows a close button in the header (phones; the desktop frame has its own). */
  onClose?: () => void;
  /** Inside the desktop phone frame: leave room for the camera island. */
  framed?: boolean;
}

/** The app itself: header, the current screen, a floating 3-tab nav and toasts. */
export function AppChrome({ onClose, framed = false }: AppChromeProps) {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Screens scroll inside <main>, which persists across tabs: start each screen at the top.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-paper">
      <AppHeader onClose={onClose} framed={framed} />
      <main ref={mainRef} className="app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </main>
      <AppTabs />
      <ToastViewport />
    </div>
  );
}

function AppHeader({ onClose, framed }: AppChromeProps) {
  const t = useStrings(appShellStrings);
  const { lowBandwidth } = useSettings();
  const server = useServerStatus();

  return (
    <header
      className={cn(
        'relative z-10 shrink-0 border-b border-ink/5 bg-paper/95 px-4 pb-3',
        framed ? 'pt-12' : 'pt-[max(0.75rem,env(safe-area-inset-top))]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo className="size-10 rounded-xl" />
          <span className="min-w-0">
            <span className="block font-display text-lg leading-tight font-extrabold tracking-display">
              {config.appName}
            </span>
            <span className="block truncate text-xs font-semibold text-ink-soft">{t.tagline}</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <LanguageSelector />
          {onClose && (
            <m.button
              type="button"
              onClick={onClose}
              aria-label={t.closeApp}
              className="flex size-12 items-center justify-center rounded-full bg-white text-ink ring-1 ring-ink/10"
              {...pressable}
            >
              <X aria-hidden className="size-5" />
            </m.button>
          )}
        </div>
      </div>
      {(server.mocks || server.offline || lowBandwidth) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {server.mocks && (
            <Badge tone="accent">
              <span aria-hidden className="size-2 rounded-full bg-marigold-400" />
              {t.demoData}
            </Badge>
          )}
          {server.offline && (
            <Badge tone="danger">
              <span aria-hidden className="size-2 rounded-full bg-red-500" />
              {t.offline}
            </Badge>
          )}
          {lowBandwidth && (
            <Badge tone="info">
              <span aria-hidden className="size-2 rounded-full bg-sky-500" />
              {t.lowData}
            </Badge>
          )}
        </div>
      )}
    </header>
  );
}

/** Ask / My schemes / SMS. Tab switches replace history, so Back closes the app. */
function AppTabs() {
  const t = useStrings(appShellStrings);
  const location = useLocation();

  return (
    <nav
      aria-label={t.navLabel}
      className="relative z-10 shrink-0 px-3 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="grid grid-cols-3 gap-1 rounded-[1.75rem] bg-white/95 p-1.5 shadow-lift ring-1 ring-ink/5">
        {TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            replace
            state={carryAppState(location.state)}
            className={({ isActive }) =>
              cn(
                'relative isolate flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[1.4rem] text-[13px] font-bold transition-colors',
                isActive ? 'text-leaf-600' : 'text-ink-soft hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <m.span
                    layoutId="app-tab-indicator"
                    aria-hidden
                    className="absolute inset-0 -z-10 rounded-[1.4rem] bg-leaf-100"
                    transition={spring}
                  />
                )}
                <Icon aria-hidden className="size-6" strokeWidth={isActive ? 2.4 : 2} />
                {t[label]}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
