import type { LanguageCode } from '@gram-saathi/shared';
import { Info } from 'lucide-react';
import { getLanguage } from '@/features/language/languages';
import { format, useStrings } from '@/lib/i18n';
import type { VoiceNote } from './speak';
import { voiceStrings } from './strings';

/** Small honest label under an answer whose speech is not a reviewed dialect voice. */
export function VoiceNoteLine({ note, language }: { note: VoiceNote; language: LanguageCode }) {
  const t = useStrings(voiceStrings);
  const text =
    note === 'named-dialect'
      ? t.voiceNamedDialect
      : format(t.voiceApproximate, { language: getLanguage(language)?.nativeName ?? language });
  return (
    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500">
      <Info aria-hidden className="size-3.5 shrink-0" />
      {text}
    </p>
  );
}
