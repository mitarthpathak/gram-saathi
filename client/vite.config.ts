import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

// The one .env file lives at the repo root (shared with the server). Only VITE_* variables
// reach the browser bundle.
const envDir = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig(({ mode }) => {
  const { PORT = '4000' } = loadEnv(mode, envDir, '');
  // The browser calls /api on the Vite server, which forwards to Express: no CORS in dev,
  // and a phone on the same Wi-Fi (`npm run dev -w client -- --host`) needs only one port.
  const proxy = { '/api': { target: `http://localhost:${PORT}`, changeOrigin: true } };

  return {
    envDir,
    // TODO(step-3): add vite-plugin-pwa (manifest + service worker) for install and offline.
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
  };
});
