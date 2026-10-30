import { ClipboardCheck, MessageCircle, Smartphone } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { LanguageSelector } from '@/features/language/LanguageSelector';
import { cn } from '@/lib/cn';
import { config } from '@/lib/config';
import { useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { appStrings } from './strings';
import { useServerStatus } from './useServerStatus';

const TABS = [
  { to: '/', label: 'navAsk', Icon: MessageCircle },
  { to: '/eligibility', label: 'navEligibility', Icon: ClipboardCheck },
  { to: '/sms', label: 'navSms', Icon: Smartphone },
] as const;

/** App shell: header with language picker and status badges, the screen, bottom navigation. */
export function Layout() {
  const t = useStrings(appStrings);
  const { lowBandwidth } = useSettings();
  const server = useServerStatus();
  const showStatus = server.mocks || server.offline || lowBandwidth;
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Screens scroll inside <main>, which persists across routes: start each screen at the top.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-white shadow-xl">
      <header className="border-b border-slate-200 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" className="size-9" />
            <span className="text-xl font-bold text-brand-800">{config.appName}</span>
          </div>
          <LanguageSelector />
        </div>
        {showStatus && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {server.mocks && <Badge tone="info">{t.demoData}</Badge>}
            {server.offline && <Badge tone="danger">{t.offline}</Badge>}
            {lowBandwidth && <Badge tone="warning">{t.lowData}</Badge>}
          </div>
        )}
      </header>

      <main ref={mainRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </main>

      <nav
        aria-label={t.navLabel}
        className="grid grid-cols-3 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
      >
        {TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              cn(
                'flex min-h-16 flex-col items-center justify-center gap-1 text-sm font-semibold',
                isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:text-brand-800',
              )
            }
          >
            <Icon aria-hidden className="size-7" />
            {t[label]}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
