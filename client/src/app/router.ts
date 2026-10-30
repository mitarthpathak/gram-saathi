import { createBrowserRouter } from 'react-router';
import { ChatScreen } from '@/features/chat/ChatScreen';
import { EligibilityScreen } from '@/features/eligibility/EligibilityScreen';
import { SmsScreen } from '@/features/sms/SmsScreen';
import { DialectScreen } from '@/features/dialect/DialectScreen';
import { ContributorScreen } from '@/features/contribute/ContributorScreen';
import { Layout } from './Layout';
import { NotFoundScreen } from './NotFoundScreen';
import { RouteError } from './RouteError';

// One route per screen. The bottom navigation in Layout.tsx links to these paths.
export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    ErrorBoundary: RouteError,
    children: [
      { index: true, Component: ChatScreen },
      { path: 'eligibility', Component: EligibilityScreen },
      { path: 'sms', Component: SmsScreen },
      { path: 'dialects', Component: DialectScreen },
      { path: 'contribute', Component: ContributorScreen },
      { path: '*', Component: NotFoundScreen },
    ],
  },
]);
