import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export interface ServerStatus {
  /** The API (or the browser mocks) serves demo data. */
  mocks: boolean;
  /** The API could not be reached. */
  offline: boolean;
}

const RETRY_MS = 2000;
const MAX_RETRIES = 5;

/** Pings /api/health on start (retrying while the API boots) and whenever the browser reconnects. */
export function useServerStatus(): ServerStatus {
  const [status, setStatus] = useState<ServerStatus>({ mocks: false, offline: false });

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;

    const check = (attempt: number) => {
      api
        .health()
        .then((health) => {
          if (!cancelled) setStatus({ mocks: health.mocks, offline: false });
        })
        .catch(() => {
          if (cancelled) return;
          // `npm run dev` starts client and server together: don't flash "offline" on the first miss.
          if (attempt > 0) setStatus((current) => ({ ...current, offline: true }));
          if (attempt < MAX_RETRIES) {
            retryTimer = window.setTimeout(() => check(attempt + 1), RETRY_MS);
          }
        });
    };

    check(0);
    const onOnline = () => check(MAX_RETRIES);
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return status;
}
