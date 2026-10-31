import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { LanguageSelector } from '@/features/language/LanguageSelector';
import { config } from '@/lib/config';
import { useStrings } from '@/lib/i18n';
import { landingStrings } from './strings';

/** Minimal top bar: wordmark on the left, the language pill on the right. Scrolls away. */
export function SiteHeader() {
  const t = useStrings(landingStrings);
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="mx-auto flex max-w-[92rem] items-center justify-between gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 lg:px-[6vw] lg:pt-6">
        <Link to="/" aria-label={t.homeLink} className="flex items-center gap-2.5 rounded-2xl">
          <Logo className="size-10 rounded-[0.8rem] shadow-soft" />
          <span aria-hidden className="font-display text-xl font-extrabold tracking-display">
            {config.appName}
          </span>
        </Link>
        <LanguageSelector />
      </div>
    </header>
  );
}
