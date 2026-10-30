import { ClipboardCheck, MessageCircle, Smartphone } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { Badge } from '@/components/ui/Badge';
import { ToastViewport } from '@/components/ui/Toast';
import { LanguageSelector } from '@/features/language/LanguageSelector';
import { cn } from '@/lib/cn';
import { config } from '@/lib/config';
import { useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { Showcase } from './Showcase';
import { appStrings } from './strings';
import { useServerStatus } from './useServerStatus';

const TABS = [
  { to: '/', label: 'navAsk', Icon: MessageCircle },
  { to: '/eligibility', label: 'navEligibility', Icon: ClipboardCheck },
  { to: '/sms', label: 'navSms', Icon: Smartphone },
] as const;

/**
 * App shell: header with language picker and status badges, the screen, bottom navigation.
 * Phones get the app full screen; on a laptop it sits in a phone frame next to a pitch panel.
 */
export function Layout() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Screens scroll inside <main>, which persists across routes: start each screen at the top.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="relative min-h-dvh lg:flex lg:h-dvh lg:items-center lg:justify-center lg:gap-14 lg:overflow-hidden lg:px-10 lg:py-6 xl:gap-24">
      <StageBackdrop />
      <Showcase className="hidden lg:flex" />

      <div className="lg:relative lg:z-10 lg:h-[min(52rem,calc(100dvh-3rem))] lg:w-[25rem] lg:shrink-0 lg:rounded-[3.25rem] lg:bg-slate-950 lg:p-3 lg:shadow-[0_50px_120px_-30px_rgba(0,0,0,0.75)] lg:ring-1 lg:ring-white/15">
        <PhoneButtons />
        <div className="relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-cream-100 md:shadow-2xl lg:h-full lg:max-w-none lg:rounded-[2.5rem] lg:shadow-none">
          <div
            aria-hidden
            className="absolute top-2.5 left-1/2 z-30 hidden h-7 w-28 -translate-x-1/2 rounded-full bg-slate-950 lg:block"
          />
          <AppHeader />
          <main ref={mainRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <Outlet />
          </main>
          <BottomNav />
          <ToastViewport />
        </div>
      </div>
    </div>
  );
}

function AppHeader() {
  const t = useStrings(appStrings);
  const { lowBandwidth } = useSettings();
  const server = useServerStatus();
  const showStatus = server.mocks || server.offline || lowBandwidth;

  return (
    <header className="relative z-10 shrink-0 overflow-hidden bg-linear-to-br from-brand-800 via-brand-700 to-brand-600 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-white lg:pt-12">
      <div aria-hidden className="absolute inset-0 bg-kolam opacity-70" />
      <div
        aria-hidden
        className="absolute -top-16 -right-10 size-44 rounded-full bg-marigold-400/25 blur-2xl"
      />
      <div className="relative flex items-center justify-between gap-3">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Logo className="size-10 rounded-xl ring-2 ring-white/25" />
          <span className="min-w-0">
            <span className="block text-lg leading-tight font-extrabold tracking-tight">
              {config.appName}
            </span>
            <span className="block truncate text-xs font-semibold text-brand-100">{t.tagline}</span>
          </span>
        </Link>
        <LanguageSelector />
      </div>
      {showStatus && (
        <div className="relative mt-2.5 flex flex-wrap gap-1.5">
          {server.mocks && (
            <Badge tone="glass">
              <span aria-hidden className="size-2 rounded-full bg-marigold-300" />
              {t.demoData}
            </Badge>
          )}
          {server.offline && (
            <Badge tone="glass">
              <span aria-hidden className="size-2 rounded-full bg-red-400" />
              {t.offline}
            </Badge>
          )}
          {lowBandwidth && (
            <Badge tone="glass">
              <span aria-hidden className="size-2 rounded-full bg-sky-300" />
              {t.lowData}
            </Badge>
          )}
        </div>
      )}
    </header>
  );
}

function BottomNav() {
  const t = useStrings(appStrings);
  return (
    <nav
      aria-label={t.navLabel}
      className="relative z-10 grid shrink-0 grid-cols-3 border-t border-brand-950/5 bg-white/95 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
    >
      {TABS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            cn(
              'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[13px] font-bold transition focus-visible:outline-3 focus-visible:outline-brand-600',
              isActive ? 'text-brand-800' : 'text-slate-500 hover:text-brand-700',
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  'flex h-8 w-14 items-center justify-center rounded-full transition',
                  isActive && 'bg-brand-100',
                )}
              >
                <Icon aria-hidden className="size-6" strokeWidth={isActive ? 2.4 : 2} />
              </span>
              {t[label]}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/** Dark green stage with soft glows behind the desktop showcase. */
function StageBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--color-brand-700),transparent_55%),radial-gradient(ellipse_at_bottom_right,var(--color-brand-800),transparent_50%)]" />
      <div className="absolute inset-0 bg-kolam opacity-30" />
      <div className="absolute top-1/4 -left-24 size-96 animate-float rounded-full bg-brand-500/25 blur-3xl" />
      <div className="absolute right-[6%] -bottom-24 size-[28rem] rounded-full bg-marigold-500/15 blur-3xl" />
    </div>
  );
}

/** Side buttons of the desktop phone frame. */
function PhoneButtons() {
  return (
    <div aria-hidden className="hidden lg:block">
      <span className="absolute top-32 -left-1 h-10 w-1 rounded-l bg-slate-800" />
      <span className="absolute top-48 -left-1 h-16 w-1 rounded-l bg-slate-800" />
      <span className="absolute top-40 -right-1 h-20 w-1 rounded-r bg-slate-800" />
    </div>
  );
}
