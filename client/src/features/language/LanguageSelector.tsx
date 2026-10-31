import type { LanguageCode } from '@gram-saathi/shared';
import { ChevronDown, Languages } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { LANGUAGES } from './languages';
import { languageStrings } from './strings';

interface LanguageSelectorProps {
  /** "compact": dropdown for the green header. "grid": big buttons, e.g. on the empty chat screen. */
  variant?: 'compact' | 'grid';
  className?: string;
}

export function LanguageSelector({ variant = 'compact', className }: LanguageSelectorProps) {
  const { language, languageHint, setLanguage, setLanguageHint } = useSettings();
  const t = useStrings(languageStrings);

  if (variant === 'grid') {
    return (
      <div
        role="radiogroup"
        aria-label={t.label}
        className={cn('grid grid-cols-4 gap-2', className)}
      >
        {LANGUAGES.map((option) => {
          const selected = option.code === language;
          return (
            <button
              key={option.code}
              type="button"
              role="radio"
              aria-checked={selected}
              lang={option.code}
              onClick={() => setLanguage(option.code)}
              className={cn(
                'min-h-12 rounded-2xl px-1 text-base font-bold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                selected
                  ? 'bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-soft'
                  : 'bg-cream-100 text-slate-800 ring-1 ring-brand-950/10 hover:ring-brand-500',
              )}
            >
              {option.nativeName}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <label className={cn('relative flex shrink-0 items-center', className)}>
      <span className="sr-only">{t.label}</span>
      <Languages
        aria-hidden
        className="pointer-events-none absolute left-2.5 size-[18px] text-white"
      />
      <select
        value={languageHint ?? 'auto'}
        onChange={(event) => {
          if (event.target.value === 'auto') setLanguageHint(null);
          else setLanguage(event.target.value as LanguageCode);
        }}
        className="min-h-12 w-36 appearance-none rounded-full bg-white/15 py-1 pr-8 pl-8 text-base font-bold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <option value="auto" className="text-slate-900">
          {t.auto}
        </option>
        {LANGUAGES.map((option) => (
          <option
            key={option.code}
            value={option.code}
            lang={option.code}
            className="text-slate-900"
          >
            {option.nativeName}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2.5 size-4 text-white/80"
      />
    </label>
  );
}
