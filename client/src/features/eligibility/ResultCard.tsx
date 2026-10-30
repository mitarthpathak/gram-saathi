import type { EligibilityResult } from '@gram-saathi/shared';
import { CircleCheck, CircleX } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { useStrings } from '@/lib/i18n';
import { eligibilityStrings } from './strings';

export function ResultCard({ result }: { result: EligibilityResult }) {
  const t = useStrings(eligibilityStrings);

  return (
    <Card
      className={cn(
        'flex gap-3 border-2',
        result.eligible ? 'border-brand-600 bg-brand-50' : 'border-slate-200',
      )}
    >
      {result.eligible ? (
        <CircleCheck aria-hidden className="size-9 shrink-0 text-brand-700" />
      ) : (
        <CircleX aria-hidden className="size-9 shrink-0 text-slate-400" />
      )}
      <div className="flex flex-col items-start gap-1.5">
        <h3 className="text-lg font-bold">{result.schemeName}</h3>
        <Badge tone={result.eligible ? 'success' : 'neutral'}>
          {result.eligible ? t.eligible : t.notEligible}
        </Badge>
        <p className="text-base text-slate-700">{result.reason}</p>
      </div>
    </Card>
  );
}
