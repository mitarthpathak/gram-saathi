// The app screens are split from the landing page's bundle and fetched on demand.

export const loadAppRoute = () => import('./AppRoute');
export const loadChatScreen = () => import('@/features/chat/ChatScreen');
export const loadEligibilityScreen = () => import('@/features/eligibility/EligibilityScreen');
export const loadSmsScreen = () => import('@/features/sms/SmsScreen');

/** Warms the cache (on hover / focus of an "Open app" button, or when the browser is idle). */
export function preloadApp(): void {
  void loadAppRoute();
  void loadChatScreen();
}
