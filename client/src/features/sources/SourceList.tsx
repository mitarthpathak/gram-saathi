import type { Source } from '@gram-saathi/shared';
import { BadgeCheck } from 'lucide-react';
import { useStrings } from '@/lib/i18n';
import { SourceCard } from './SourceCard';
import { sourceStrings } from './strings';

/** Citations shown under every grounded answer. */
export function SourceList({ sources }: { sources: Source[] }) {
  const t = useStrings(sourceStrings);
  if (sources.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-base font-extrabold text-brand-800">
        <BadgeCheck aria-hidden className="size-4" />
        {t.title}
      </h3>
      <ol className="flex flex-wrap gap-2">
        {sources.map((source, index) => (
          <li key={`${source.schemeId}:${source.section}:${index}`}>
            <SourceCard source={source} index={index + 1} />
          </li>
        ))}
      </ol>
    </section>
  );
}
