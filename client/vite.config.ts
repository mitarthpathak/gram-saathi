import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// The one .env file lives at the repo root (shared with the server). Only VITE_* variables
// reach the browser bundle.
const envDir = fileURLToPath(new URL('..', import.meta.url));

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

function scriptsAfterFirstPaint(): Plugin {
  return {
    name: 'gram-saathi:scripts-after-first-paint',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const preloads: string[] = [];
        let entry = '';
        const rest = html
          .replace(
            /\s*<link rel="modulepreload" crossorigin href="([^"]+)">/g,
            (_, href: string) => {
              preloads.push(href);
              return '';
            },
          )
          .replace(
            /\s*<script type="module" crossorigin src="([^"]+)"><\/script>/,
            (_, src: string) => {
              entry = src;
              return '';
            },
          );
        if (!entry) return html;
        const loader = `<script>(function(){function go(){${JSON.stringify(preloads)}.forEach(function(h){var l=document.createElement('link');l.rel='modulepreload';l.crossOrigin='';l.href=h;document.head.appendChild(l)});var s=document.createElement('script');s.type='module';s.crossOrigin='';s.src=${JSON.stringify(entry)};document.head.appendChild(s)}if(document.visibilityState==='hidden')go();else requestAnimationFrame(function(){setTimeout(go)})})()</script>`;
        return rest.replace('</body>', `${loader}</body>`);
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
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'pwa-icon.svg'],
        manifest: {
          name: 'Gram Saathi',
          short_name: 'Gram Saathi',
          description: 'Ask about government schemes in your language.',
          theme_color: '#fff9f0',
          background_color: '#fffdf8',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: '/pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
          ],
        },
        workbox: {
          clientsClaim: true,
          skipWaiting: true,
          cleanupOutdatedCaches: true,
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname === '/api/faq/top',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'faq-top-v1',
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ url }) => url.pathname === '/api/dialects',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'dialects-v1',
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: { enabled: true, type: 'module' },
      }),
      preloadDisplayFont(),
      scriptsAfterFirstPaint(),
    ],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
  };
});
