import type { Source } from '@gram-saathi/shared';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { useStrings } from '@/lib/i18n';
import { sourceStrings } from './strings';

interface SourceCardProps {
  source: Source;
  /** 1-based citation number shown in the circle. */
  index: number;
}

/** One citation: scheme, document section and the quoted snippet the answer is based on. */
export function SourceCard({ source, index }: SourceCardProps) {
  const t = useStrings(sourceStrings);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex max-w-full flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="inline-flex min-h-12 max-w-full items-center gap-2 rounded-full bg-brand-50 px-4 text-left text-base font-bold text-brand-900 ring-1 ring-brand-200 transition hover:bg-brand-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-extrabold text-white"
        >
          {index}
        </span>
        <span className="min-w-0 break-words">
          {source.schemeName}
          <span className="font-semibold text-slate-600"> · {source.section}</span>
        </span>
        <ChevronDown aria-hidden className={cn('size-4 shrink-0 transition', expanded && 'rotate-180')} />
        <span className="sr-only">{expanded ? t.showLess : t.showMore}</span>
      </button>
      {expanded && (
        <blockquote className="ml-3 max-w-full rounded-2xl border-l-2 border-brand-400 bg-cream-100 px-4 py-3 text-base leading-relaxed text-slate-700">
          “{source.snippet}”
        </blockquote>
      )}
    </div>
  );
}
