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

/**
 * The page is prerendered (scripts/prerender.mjs), so JavaScript is not needed for the first
 * paint. Instead of <script> / modulepreload tags in <head>, a tiny loader at the end of <body>
 * adds them right after the first frame (at once if the tab is hidden): HTML, CSS and the
 * display font get the network to themselves, and hydration starts one frame later.
 */
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
    // TODO(step-3): add vite-plugin-pwa (manifest + service worker) for install and offline.
    plugins: [react(), tailwindcss(), preloadDisplayFont(), scriptsAfterFirstPaint()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
  };
});
