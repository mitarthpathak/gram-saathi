import { ShieldAlert } from 'lucide-react';

/** The anti-fraud reminder the API attaches to every answer. */
export function FraudWarning({ text }: { text: string }) {
  return (
    <aside
      role="note"
      className="flex gap-2.5 rounded-2xl bg-linear-to-r from-marigold-50 to-amber-50 p-3 ring-1 ring-marigold-200"
    >
      <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-marigold-600" />
      <p className="text-sm leading-snug font-semibold text-marigold-900">{text}</p>
    </aside>
  );
}
