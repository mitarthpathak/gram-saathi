import { createBrowserRouter, redirect } from 'react-router';
import {
  loadAppRoute,
  loadChatScreen,
  loadEligibilityScreen,
  loadSmsScreen,
} from '@/features/app-shell/loaders';
import { NotFoundScreen } from './NotFoundScreen';
import { RouteError } from './RouteError';
import { SiteShell } from './SiteShell';

/**
 * "/" is the landing page (rendered by SiteShell); "/app/*" is the app. The app screens are
 * lazy, so the landing page never downloads them up front. Vercel rewrites every path to
 * index.html, so these are all real, shareable URLs.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    Component: SiteShell,
    ErrorBoundary: RouteError,
    children: [
      { index: true },
      {
        path: 'app',
        lazy: async () => ({ Component: (await loadAppRoute()).AppRoute }),
        children: [
          { index: true, lazy: async () => ({ Component: (await loadChatScreen()).ChatScreen }) },
          {
            path: 'eligibility',
            lazy: async () => ({ Component: (await loadEligibilityScreen()).EligibilityScreen }),
          },
          { path: 'sms', lazy: async () => ({ Component: (await loadSmsScreen()).SmsScreen }) },
          { path: '*', Component: NotFoundScreen },
        ],
      },
      // Paths from before the landing page existed.
      { path: 'chat', loader: () => redirect('/app') },
      { path: 'eligibility', loader: () => redirect('/app/eligibility') },
      { path: 'sms', loader: () => redirect('/app/sms') },
      { path: '*', Component: NotFoundScreen },
    ],
  },
]);
