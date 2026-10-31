import type { DialectOption, QueryResponse } from '@gram-saathi/shared';
import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { useStrings, format } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { dialectStrings } from './strings';
import { getDialectPromptMode } from './dialectLogic';

export function DialectPrompt({ response }: { response: QueryResponse }) {
  const t = useStrings(dialectStrings);
  const { dialectHint, setDialectHint, setLanguage } = useSettings();
  const mode = getDialectPromptMode(response);
  const confirmRef = useRef<HTMLDivElement>(null);
  const candidates = useMemo<DialectOption[]>(() => {
    if (response.dialectCandidates?.length) return response.dialectCandidates;
    return response.dialect ? [response.dialect] : [];
  }, [response.dialect, response.dialectCandidates]);

  useEffect(() => {
    if (mode === 'confirm') confirmRef.current?.focus();
  }, [mode]);

  if (!mode) return null;
  if (mode === 'high' && response.dialect) {
    return (
      <div className="dialect-reveal flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand-50 px-3 py-2.5 ring-1 ring-brand-200 shadow-soft">
        <p className="text-base font-extrabold text-brand-950">
          {format(t.high, {
            name: response.dialect.name,
            nativeName: response.dialect.nativeName,
          })}
        </p>
        <Link
          to="/dialects"
          className="inline-flex min-h-12 items-center rounded-full px-3 text-base font-bold text-brand-800 underline decoration-brand-300 underline-offset-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {t.wrong}
        </Link>
      </div>
    );
  }

  if (candidates.length === 0) return null;
  return (
    <div
      ref={confirmRef}
      tabIndex={-1}
      aria-live="polite"
      className="dialect-reveal rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200 shadow-soft focus:outline-2 focus:outline-amber-500"
    >
      <p className="text-base font-extrabold text-slate-900">
        {format(t.maybe, { name: candidates[0].nativeName || candidates[0].name })}
      </p>
      <div className="mt-2 grid gap-2">
        {candidates.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            onClick={() => {
              setDialectHint(candidate.id);
            }}
            className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-white px-3 text-left font-bold text-slate-800 ring-1 ring-amber-200 hover:ring-brand-500 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <span>
              {candidate.nativeName
                ? `${candidate.name} · ${candidate.nativeName}`
                : candidate.name}
            </span>
            <Badge tone={dialectHint === candidate.id ? 'success' : 'accent'}>
              {dialectHint === candidate.id ? t.selected : t.choose}
            </Badge>
          </button>
        ))}
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/dialects"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-3 text-center text-base font-bold text-brand-800 ring-1 ring-brand-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {t.other}
          </Link>
          <button
            type="button"
            onClick={() => {
              setDialectHint(null);
              setLanguage('hi');
            }}
            className="min-h-12 rounded-xl bg-white px-3 text-base font-bold text-slate-800 ring-1 ring-slate-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {t.hindi}
          </button>
        </div>
      </div>
    </div>
  );
}
