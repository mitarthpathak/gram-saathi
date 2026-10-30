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
    <div className="rounded-2xl bg-cream-100 px-3 py-2.5 ring-1 ring-brand-950/5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-extrabold text-white"
        >
          {index}
        </span>
        <span className="min-w-0 text-sm leading-tight font-bold text-slate-800">
          {source.schemeName}
          <span className="font-semibold text-slate-500"> · {source.section}</span>
        </span>
      </div>
      <blockquote
        className={cn(
          'mt-1.5 border-l-2 border-brand-300 pl-2.5 text-sm leading-snug text-slate-600',
          !expanded && 'line-clamp-2',
        )}
      >
        “{source.snippet}”
      </blockquote>
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="mt-1 inline-flex min-h-8 items-center gap-1 text-[13px] font-bold text-brand-700"
      >
        {expanded ? t.showLess : t.showMore}
        <ChevronDown aria-hidden className={cn('size-4 transition', expanded && 'rotate-180')} />
      </button>
    </div>
  );
}
