import type { EligibilityResult } from '@gram-saathi/shared';
import { CircleCheck, CircleX, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { useStrings } from '@/lib/i18n';
import { eligibilityStrings } from './strings';

interface ResultCardProps {
  result: EligibilityResult;
  /** Opens the chat with a question about this scheme. */
  onAsk?: (schemeName: string) => void;
}

export function ResultCard({ result, onAsk }: ResultCardProps) {
  const t = useStrings(eligibilityStrings);

  return (
    <div
      className={cn(
        'relative flex gap-3 overflow-hidden rounded-3xl p-4',
        result.eligible
          ? 'bg-white shadow-soft ring-2 ring-leaf-400'
          : 'bg-white/60 ring-1 ring-ink/10',
      )}
    >
      {result.eligible ? (
        <CircleCheck aria-hidden className="size-9 shrink-0 fill-leaf-100 text-leaf-600" />
      ) : (
        <CircleX aria-hidden className="size-9 shrink-0 text-slate-400" />
      )}
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <h3
          className={cn(
            'text-lg leading-snug font-extrabold',
            !result.eligible && 'text-slate-700',
          )}
        >
          {result.schemeName}
        </h3>
        <Badge tone={result.eligible ? 'success' : 'neutral'}>
          {result.eligible ? t.eligible : t.notEligible}
        </Badge>
        <p className="text-base leading-snug text-slate-700">{result.reason}</p>
        {result.eligible && onAsk && (
          <Button
            variant="soft"
            size="sm"
            className="mt-1"
            onClick={() => onAsk(result.schemeName)}
          >
            <MessageCircle aria-hidden className="size-4" />
            {t.askAbout}
          </Button>
        )}
      </div>
    </div>
  );
}
