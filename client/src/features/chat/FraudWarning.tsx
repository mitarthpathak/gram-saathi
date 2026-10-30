import { ShieldAlert } from 'lucide-react';

/** The anti-fraud reminder the API attaches to every answer. */
export function FraudWarning({ text }: { text: string }) {
  return (
    <aside
      role="note"
      className="flex gap-3 rounded-xl border-l-4 border-amber-500 bg-amber-50 p-3 text-amber-950"
    >
      <ShieldAlert aria-hidden className="mt-0.5 size-6 shrink-0 text-amber-700" />
      <p className="text-base font-medium">{text}</p>
    </aside>
  );
}
