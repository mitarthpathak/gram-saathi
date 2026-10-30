/// <reference types="vite/client" />

// Typed VITE_* variables (read from the root .env). Everything here ends up in the public bundle.
interface ImportMetaEnv {
  /** API origin for production builds, e.g. https://api.example.com. Leave empty in dev. */
  readonly VITE_API_URL?: string;
  /** "true" to serve src/mocks in the browser instead of calling the server. */
  readonly VITE_USE_MOCKS?: string;
}
