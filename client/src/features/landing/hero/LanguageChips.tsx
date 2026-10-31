import type { CSSProperties } from 'react';
import { LANGUAGES } from '@/features/language/languages';
import { cn } from '@/lib/cn';
import { useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { landingStrings } from '../strings';

/** The four languages, each in its own script. Tapping one switches the page to it. */
export function LanguageChips({ className, style }: { className?: string; style?: CSSProperties }) {
  const t = useStrings(landingStrings);
  const { language, setLanguage } = useSettings();

  return (
    <div
      role="radiogroup"
      aria-label={t.languagesLabel}
      className={cn('flex flex-wrap gap-2.5', className)}
      style={style}
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
              // 38 px chip, 48 px touch target.
              "relative h-[2.375rem] rounded-full px-4 text-[15px] font-semibold ring-1 transition before:absolute before:-inset-x-1 before:-inset-y-[5px] before:content-[''] active:scale-95",
              selected
                ? 'bg-leaf-50 text-leaf-600 ring-leaf-500/60'
                : 'bg-paper/60 text-ink ring-ink/15 hover:ring-ink/35',
            )}
          >
            {option.nativeName}
          </button>
        );
      })}
    </div>
  );
}
