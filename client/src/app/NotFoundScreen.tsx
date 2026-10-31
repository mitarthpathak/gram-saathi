import { Link } from 'react-router';
import { useStrings } from '@/lib/i18n';
import { appStrings } from './strings';

export function NotFoundScreen() {
  const t = useStrings(appStrings);
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <h1 className="font-display text-3xl font-extrabold tracking-display">{t.notFoundTitle}</h1>
      <Link
        to="/"
        className="inline-flex min-h-12 items-center rounded-full bg-leaf-600 px-6 text-lg font-bold text-white shadow-leaf"
      >
        {t.goHome}
      </Link>
    </div>
  );
}
