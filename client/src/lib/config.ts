/** Build-time configuration. Values come from VITE_* variables in the root .env (all public). */
export const config = {
  /** Display name: rename the project here and in index.html. */
  appName: 'Gram Saathi',
  /** API origin. Empty = same origin (in dev, Vite proxies /api to the Express server). */
  apiUrl: (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, ''),
  /** true = answer every call from src/mocks in the browser; the server is never contacted. */
  useMocks: import.meta.env.VITE_USE_MOCKS === 'true',
  /** Fake network delay for browser mocks so loading states are visible. */
  mockLatencyMs: 600,
} as const;
