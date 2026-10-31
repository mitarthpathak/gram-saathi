import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/motion/useMediaQuery';
import { AppChrome } from './AppChrome';
import { AppFullscreen } from './AppFullscreen';
import { AppSheet } from './AppSheet';
import type { AppLocationState } from './navigation';

/**
 * /app and its screens. Desktop: a framed phone over the landing page (a route modal, so the
 * URL is shareable and Back closes it). Phones: full screen.
 */
export function AppRoute() {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const navigate = useNavigate();
  const location = useLocation();
  const overLanding = Boolean((location.state as AppLocationState | null)?.backgroundLocation);

  // Opened from the landing page: go back to it. Opened from a link: replace with the landing.
  const close = useCallback(() => {
    if (overLanding) void navigate(-1);
    else void navigate('/', { replace: true });
  }, [overLanding, navigate]);

  if (isDesktop) {
    return (
      <AppSheet onClose={close}>
        <AppChrome framed />
      </AppSheet>
    );
  }
  return (
    <AppFullscreen overLanding={overLanding}>
      <AppChrome onClose={close} />
    </AppFullscreen>
  );
}
