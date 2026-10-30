import { Signal } from 'lucide-react';
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
    <figure className="mx-auto w-64 rounded-[2.5rem] bg-slate-800 p-4 pb-6 shadow-2xl ring-4 ring-slate-900">
      <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-slate-600" aria-hidden />
      <div className="rounded-lg border-4 border-slate-900 bg-[#c5d8a4] p-2 font-mono text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-900/30 pb-1 text-xs font-bold">
          <span>{sender}</span>
          <Signal aria-hidden className="size-3.5" />
        </div>
        <p className="mt-1 h-44 overflow-y-auto text-[13px] leading-snug break-words whitespace-pre-wrap">
          {sms ?? t.noAnswerYet}
        </p>
        {sms && (
          <figcaption className="mt-1 border-t border-slate-900/30 pt-1 text-right text-[11px] font-bold">
            {format(t.smsCount, { segments, chars: sms.length })}
          </figcaption>
        )}
      </div>
      <div aria-hidden className="mt-4 grid grid-cols-3 gap-2">
        {KEYS.map(([digit, letters]) => (
          <div
            key={digit}
            className="flex h-9 flex-col items-center justify-center rounded-lg bg-slate-700 text-white"
          >
            <span className="text-sm leading-none font-bold">{digit}</span>
            <span className="text-[8px] leading-none text-slate-300 uppercase">{letters}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
