import { Link } from 'react-router';
import { useStrings } from '@/lib/i18n';
import { appStrings } from './strings';

export function NotFoundScreen() {
  const t = useStrings(appStrings);
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
      <h1 className="text-2xl font-bold">{t.notFoundTitle}</h1>
      <Link to="/" className="text-lg font-semibold text-leaf-600 underline">
        {t.goHome}
      </Link>
    </div>
  );
}
