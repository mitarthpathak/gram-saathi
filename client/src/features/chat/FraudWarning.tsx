import { ShieldAlert } from 'lucide-react';

/** The anti-fraud reminder the API attaches to every answer. */
export function FraudWarning({ text }: { text: string }) {
  return (
    <aside role="note" className="flex gap-2.5 rounded-2xl bg-dusk-soft p-3 ring-1 ring-dusk-line">
      <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-marigold-300" />
      <p className="text-lg leading-snug font-semibold text-dusk-ink">{text}</p>
    </aside>
  );
}
