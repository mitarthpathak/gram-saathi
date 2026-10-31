import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// The one .env file lives at the repo root (shared with the server). Only VITE_* variables
// reach the browser bundle.
const envDir = fileURLToPath(new URL('..', import.meta.url));

/**
 * Preloads the Latin display font (22 KB) so the hero headline paints in its real face. Its
 * hashed file name only exists after bundling, hence a plugin instead of a tag in index.html.
 */
function preloadDisplayFont(): Plugin {
  return {
    name: 'gram-saathi:preload-display-font',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const file = Object.keys(context.bundle ?? {}).find((name) =>
          /bricolage-display.*\.woff2$/.test(name),
        );
        if (!file) return [];
        return [
          {
            tag: 'link',
            attrs: {
              rel: 'preload',
              href: `/${file}`,
              as: 'font',
              type: 'font/woff2',
              crossorigin: '',
            },
            injectTo: 'head',
          },
        ];
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const { PORT = '4000' } = loadEnv(mode, envDir, '');
  // The browser calls /api on the Vite server, which forwards to Express: no CORS in dev,
  // and a phone on the same Wi-Fi (`npm run dev -w client -- --host`) needs only one port.
  const proxy = { '/api': { target: `http://localhost:${PORT}`, changeOrigin: true } };

  return {
    envDir,
    // TODO(step-3): add vite-plugin-pwa (manifest + service worker) for install and offline.
    plugins: [react(), tailwindcss(), preloadDisplayFont()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
  };
});
