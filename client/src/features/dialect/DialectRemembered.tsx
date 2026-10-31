import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { DialectInfo } from '@gram-saathi/shared';
import { api } from '@/lib/api';
import { useStrings, format } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { dialectStrings } from './strings';

export function DialectRemembered() {
  const { dialectHint, setDialectHint } = useSettings();
  const t = useStrings(dialectStrings);
  const [dialect, setDialect] = useState<DialectInfo | null>(null);

  useEffect(() => {
    let active = true;
    void api.getDialects().then(({ items }) => {
      if (active) setDialect(items.find(({ id }) => id === dialectHint) ?? null);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [dialectHint]);

  if (!dialectHint) return null;
  const name = dialect ? `${dialect.name} (${dialect.nativeName})` : dialectHint;

  return (
    <div role="status" className="mb-2 flex min-h-12 flex-wrap items-center justify-center gap-x-2 rounded-2xl bg-brand-50 px-3 py-1 text-base font-bold text-brand-900 ring-1 ring-brand-200">
      <span aria-live="polite">{format(t.remembered, { name })}</span>
      <span aria-hidden>·</span>
      <Link
        to="/dialects"
        className="inline-flex min-h-12 items-center rounded-lg px-1 underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-brand-600"
      >
        {t.change}
      </Link>
      <button
        type="button"
        onClick={() => setDialectHint(null)}
        className="inline-flex min-h-12 items-center rounded-lg px-2 text-slate-600 underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-brand-600"
      >
        {t.clear}
      </button>
    </div>
  );
}
