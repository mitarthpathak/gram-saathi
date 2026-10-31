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
    <figure className="relative mx-auto w-56 rounded-[2.25rem] bg-linear-to-b from-brand-900 via-brand-950 to-slate-950 p-3 pb-4 shadow-lift ring-1 ring-white/10">
      <div aria-hidden className="mx-auto mb-3 flex justify-center gap-1">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} className="size-1 rounded-full bg-slate-950/70" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border-4 border-slate-950 bg-[#e4edc8] font-mono text-slate-900 shadow-[inset_0_0_18px_rgb(0_0_0/0.18)]">
        <div className="flex items-center justify-between bg-slate-900/10 px-2 py-1 text-[11px] font-bold">
          <span>{sender}</span>
          <span className="flex items-center gap-1">
            <Signal aria-hidden className="size-3.5" />
            <BatteryMedium aria-hidden className="size-4" />
          </span>
        </div>
        <p className="h-32 overflow-y-auto px-2 py-1.5 text-base leading-snug break-words whitespace-pre-wrap">
          {sms ?? t.noAnswerYet}
        </p>
        {sms && (
          <figcaption className="border-t border-slate-900/25 px-2 py-1 text-right text-[11px] font-bold">
            {format(t.smsCount, { segments, chars: sms.length })}
          </figcaption>
        )}
      </div>
      <div aria-hidden className="mt-3 flex items-center justify-between px-1">
        <span className="h-2.5 w-12 rounded-full bg-slate-600" />
        <span className="flex size-10 items-center justify-center rounded-full bg-slate-600 ring-4 ring-slate-700">
          <span className="size-4 rounded-full bg-slate-500" />
        </span>
        <span className="h-2.5 w-12 rounded-full bg-slate-600" />
      </div>
      <div aria-hidden className="mt-3 grid grid-cols-3 gap-2">
        {KEYS.map(([digit, letters]) => (
          <div
            key={digit}
            className="flex h-9 flex-col items-center justify-center rounded-xl bg-linear-to-b from-slate-600 to-slate-700 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]"
          >
            <span className="text-sm leading-none font-bold">{digit}</span>
            <span className="text-[8px] leading-none text-slate-300 uppercase">{letters}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
