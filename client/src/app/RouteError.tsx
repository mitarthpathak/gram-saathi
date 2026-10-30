import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useStrings } from '@/lib/i18n';
import { appStrings } from './strings';

/** Friendly fallback when a screen crashes (the error is still logged for developers). */
export function RouteError() {
  const t = useStrings(appStrings);
  const error = useRouteError();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <TriangleAlert aria-hidden className="size-14 text-amber-600" />
      <h1 className="text-2xl font-bold">{t.errorTitle}</h1>
      <Button size="lg" onClick={() => window.location.reload()}>
        {t.reload}
      </Button>
    </div>
  );
}
