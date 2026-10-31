import type { LanguageCode } from '@gram-saathi/shared';
import { ChevronDown, Languages } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { LANGUAGES } from './languages';
import { languageStrings } from './strings';

interface LanguageSelectorProps {
  /** "compact": a small pill for headers. "grid": big buttons, e.g. on the empty chat screen. */
  variant?: 'compact' | 'grid';
  className?: string;
}

export function LanguageSelector({ variant = 'compact', className }: LanguageSelectorProps) {
  const { language, setLanguage } = useSettings();
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
                'min-h-12 rounded-soft px-1 text-base font-bold transition active:scale-95',
                selected
                  ? 'bg-leaf-600 text-white shadow-leaf'
                  : 'bg-paper-alt text-ink ring-1 ring-ink/10 hover:ring-leaf-500',
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
        className="pointer-events-none absolute left-3 size-[18px] text-leaf-600"
      />
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as LanguageCode)}
        className="min-h-12 appearance-none rounded-full bg-white/85 py-1 pr-9 pl-9 text-[15px] font-bold text-ink shadow-soft ring-1 ring-ink/10 transition hover:bg-white"
      >
        {LANGUAGES.map((option) => (
          <option key={option.code} value={option.code} lang={option.code} className="text-ink">
            {option.nativeName}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 size-4 text-ink-soft"
      />
    </label>
  );
}
