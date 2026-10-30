import type { Source } from '@gram-saathi/shared';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
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
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white"
        >
          {index}
        </span>
        <span className="font-semibold">{source.schemeName}</span>
        <Badge>{source.section}</Badge>
      </div>
      <blockquote className={cn('mt-2 text-sm text-slate-700', !expanded && 'line-clamp-2')}>
        “{source.snippet}”
      </blockquote>
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="mt-1 min-h-8 text-sm font-semibold text-brand-800 underline underline-offset-2"
      >
        {expanded ? t.showLess : t.showMore}
      </button>
    </div>
  );
}
