import type { DialectInfo } from '@gram-saathi/shared';
import { ArrowLeft, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { dialectStrings } from './strings';

export function DialectScreen() {
  const t = useStrings(dialectStrings);
  const { setDialectHint } = useSettings();
  const navigate = useNavigate();
  const [items, setItems] = useState<DialectInfo[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    void api
      .getDialects()
      .then(({ items: dialects }) => {
        setItems(dialects);
        setLoading(false);
      })
      .catch(() => {
        setFailed(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let active = true;
    void api
      .getDialects()
      .then(({ items: dialects }) => {
        if (!active) return;
        setItems(dialects);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      [item.name, item.nativeName, ...item.states].some((value) =>
        value.toLocaleLowerCase().includes(term),
      ),
    );
  }, [items, query]);

  const groups = useMemo(() => {
    const byState = new Map<string, DialectInfo[]>();
    for (const item of filtered) {
      for (const state of item.states) {
        byState.set(state, [...(byState.get(state) ?? []), item]);
      }
    }
    return [...byState.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const select = (item: DialectInfo) => {
    setDialectHint(item.id);
    navigate('/app');
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div>
        <Link
          to="/app"
          aria-label={t.back}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl pr-3 font-bold text-brand-800 focus-visible:outline-3 focus-visible:outline-brand-600"
        >
          <ArrowLeft aria-hidden className="size-5" />
          {t.back}
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">{t.title}</h1>
        <p className="mt-1 text-base leading-relaxed text-slate-600">{t.intro}</p>
      </div>

      <label className="relative block">
        <span className="sr-only">{t.searchLabel}</span>
        <Search
          aria-hidden
          className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-500"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.searchPlaceholder}
          className="min-h-12 w-full rounded-2xl bg-white py-2 pr-3 pl-10 text-base text-slate-900 shadow-soft ring-1 ring-brand-950/10 placeholder:text-slate-500 focus-visible:outline-3 focus-visible:outline-brand-600"
        />
      </label>

      {loading && (
        <p role="status" className="py-4 text-center font-semibold text-slate-600">
          {t.loading}
        </p>
      )}
      {failed && (
        <div role="alert" className="rounded-2xl bg-amber-50 p-4 text-center ring-1 ring-amber-200">
          <p className="font-semibold text-slate-800">{t.loadError}</p>
          <button
            type="button"
            onClick={load}
            className="mt-2 inline-flex min-h-12 items-center rounded-full bg-brand-700 px-5 font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {t.retry}
          </button>
        </div>
      )}
      {!loading && !failed && groups.length === 0 && (
        <p
          role="status"
          className="rounded-2xl bg-white p-4 text-center font-semibold text-slate-600"
        >
          {t.noResults}
        </p>
      )}
      {!loading &&
        !failed &&
        groups.map(([state, dialects]) => (
          <section key={state} aria-label={`${t.stateLabel}: ${state}`}>
            <h2 className="mb-2 text-xs font-extrabold tracking-[0.12em] text-slate-500 uppercase">
              {state}
            </h2>
            <ul className="grid gap-2">
              {dialects.map((item) => (
                <li key={`${state}-${item.id}`}>
                  <button
                    type="button"
                    onClick={() => select(item)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-2 text-left shadow-soft ring-1 ring-brand-950/5 transition hover:ring-brand-500 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                  >
                    <span className="min-w-0">
                      <span className="block font-extrabold text-slate-900">{item.name}</span>
                      <span lang={item.parentLanguage} className="block text-sm text-slate-600">
                        {item.nativeName}
                      </span>
                    </span>
                    <Badge tone={item.testStatus === 'tested' ? 'success' : 'warning'}>
                      {item.testStatus === 'tested' ? t.tested : t.experimental}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </section>
  );
}
