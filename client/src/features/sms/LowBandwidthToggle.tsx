import { WifiOff } from 'lucide-react';
import { useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { smsStrings } from './strings';

/** Switch for low-bandwidth mode (an app-wide setting, see lib/settings.ts). */
export function LowBandwidthToggle() {
  const t = useStrings(smsStrings);
  const { lowBandwidth, setLowBandwidth } = useSettings();

  return (
    <label className="flex cursor-pointer items-center gap-4 rounded-3xl bg-white p-4 shadow-soft ring-1 ring-brand-950/5">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100">
        <WifiOff aria-hidden className="size-6 text-sky-700" />
      </span>
      <span className="flex-1">
        <span className="block text-base font-extrabold">{t.lowBandwidth}</span>
        <span className="block text-sm leading-snug text-slate-600">{t.lowBandwidthHint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={lowBandwidth}
        onChange={(event) => setLowBandwidth(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-8 w-14 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-brand-600 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 after:absolute after:top-1 after:left-1 after:size-6 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-6"
      />
    </label>
  );
}
