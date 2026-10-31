import { BatteryMedium, Signal } from 'lucide-react';
import { format, useStrings } from '@/lib/i18n';
import { smsStrings } from './strings';

interface FeaturePhoneMockProps {
  /** Message text; `null` shows a hint instead. */
  sms: string | null;
  segments: number;
  /** DLT-style sender header, as on Indian SMS. */
  sender?: string;
}

const KEYS = [
  ['1', ''],
  ['2', 'abc'],
  ['3', 'def'],
  ['4', 'ghi'],
  ['5', 'jkl'],
  ['6', 'mno'],
  ['7', 'pqrs'],
  ['8', 'tuv'],
  ['9', 'wxyz'],
  ['*', ''],
  ['0', '+'],
  ['#', ''],
];

/** A keypad phone showing how the answer arrives as an SMS on a basic phone. */
export function FeaturePhoneMock({ sms, segments, sender = 'VM-GSATHI' }: FeaturePhoneMockProps) {
  const t = useStrings(smsStrings);

  return (
    <figure className="relative mx-auto w-64 rounded-[2.75rem] bg-linear-to-b from-[#57504a] via-[#3d3731] to-ink p-4 pb-5 shadow-[0_30px_60px_-20px_rgb(38_35_31/0.6)] ring-1 ring-white/10">
      <div aria-hidden className="mx-auto mb-3 flex justify-center gap-1">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} className="size-1 rounded-full bg-ink/70" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border-4 border-ink bg-[#c7dba5] font-mono text-ink shadow-[inset_0_0_18px_rgb(0_0_0/0.18)]">
        <div className="flex items-center justify-between bg-ink/10 px-2 py-1 text-[11px] font-bold">
          <span>{sender}</span>
          <span className="flex items-center gap-1">
            <Signal aria-hidden className="size-3.5" />
            <BatteryMedium aria-hidden className="size-4" />
          </span>
        </div>
        <p className="h-44 overflow-y-auto px-2 py-1.5 text-[13px] leading-snug break-words whitespace-pre-wrap">
          {sms ?? t.noAnswerYet}
        </p>
        {sms && (
          <figcaption className="border-t border-ink/25 px-2 py-1 text-right text-[11px] font-bold">
            {format(t.smsCount, { segments, chars: sms.length })}
          </figcaption>
        )}
      </div>
      <div aria-hidden className="mt-3 flex items-center justify-between px-1">
        <span className="h-2.5 w-12 rounded-full bg-[#5d564e]" />
        <span className="flex size-10 items-center justify-center rounded-full bg-[#5d564e] ring-4 ring-[#48423b]">
          <span className="size-4 rounded-full bg-[#7a7268]" />
        </span>
        <span className="h-2.5 w-12 rounded-full bg-[#5d564e]" />
      </div>
      <div aria-hidden className="mt-3 grid grid-cols-3 gap-2">
        {KEYS.map(([digit, letters]) => (
          <div
            key={digit}
            className="flex h-9 flex-col items-center justify-center rounded-xl bg-linear-to-b from-[#5d564e] to-[#48423b] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]"
          >
            <span className="text-sm leading-none font-bold">{digit}</span>
            <span className="text-[8px] leading-none text-[#d9d2c7] uppercase">{letters}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
