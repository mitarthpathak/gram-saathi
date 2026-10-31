// Post-build step: renders "/" with the SSR bundle (dist-ssr) and writes it into
// dist/index.html, followed by a tiny boot script that sizes the scaled hero art before the
// first paint (the same maths as src/lib/useFitScale.ts). (Inlining the 16 KB stylesheet was
// measured too: the bigger HTML painted later on slow 4G.) Run by `npm run build`.
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const client = fileURLToPath(new URL('..', import.meta.url));
const htmlPath = `${client}/dist/index.html`;
const ssrEntry = pathToFileURL(`${client}/dist-ssr/prerender.js`).href;

const BOOT = `<script>document.querySelectorAll('[data-fit]').forEach(function(e){var r=e.parentElement.getBoundingClientRect();e.style.setProperty('--fit',String(Math.max(0.1,Math.min(1.15,r.width/e.offsetWidth,r.height/e.offsetHeight))))})</script>`;

// The prerendered page is the English one (index.html's head script hides it for others), so
// pin the language instead of depending on the build machine's locale.
globalThis.localStorage = {
  getItem: (key) => (key === 'gs:language' ? 'en' : null),
  setItem: () => undefined,
};

const { render } = await import(ssrEntry);
const app = await render('/');
let html = await readFile(htmlPath, 'utf8');
if (!html.includes('<div id="root"></div>')) throw new Error('dist/index.html has no empty #root');
html = html.replace('<div id="root"></div>', `<div id="root">${app}</div>${BOOT}`);
await writeFile(htmlPath, html);
await rm(`${client}/dist-ssr`, { recursive: true, force: true });
console.log(`prerendered / (${(app.length / 1024).toFixed(1)} KB of HTML)`);
