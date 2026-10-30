import type { LanguageCode } from '@gram-saathi/shared';
import { Languages } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { LANGUAGES } from './languages';
import { languageStrings } from './strings';

interface LanguageSelectorProps {
  /** "compact": dropdown for the header. "grid": big buttons, e.g. on the empty chat screen. */
  variant?: 'compact' | 'grid';
}

export function LanguageSelector({ variant = 'compact' }: LanguageSelectorProps) {
  const { language, setLanguage } = useSettings();
  const t = useStrings(languageStrings);

  if (variant === 'grid') {
    return (
      <div role="radiogroup" aria-label={t.label} className="grid grid-cols-2 gap-3">
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
                'min-h-14 rounded-2xl border-2 px-4 text-xl font-semibold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                selected
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-slate-300 bg-white text-slate-900 hover:border-brand-600',
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
    <label className="relative flex items-center">
      <span className="sr-only">{t.label}</span>
      <Languages
        aria-hidden
        className="pointer-events-none absolute left-2.5 size-5 text-brand-800"
      />
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as LanguageCode)}
        className="min-h-11 appearance-none rounded-xl border-2 border-brand-700 bg-white py-1 pr-3 pl-9 text-base font-semibold text-brand-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {LANGUAGES.map((option) => (
          <option key={option.code} value={option.code} lang={option.code}>
            {option.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
