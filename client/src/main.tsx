import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './app/App';
import './index.css';

const container = document.getElementById('root')!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// The build prerenders "/" (scripts/prerender.mjs). index.html's head script marks that HTML
// stale when it cannot match this visit (another language, low-data mode, another path);
// then it stays hidden and the app renders from scratch instead.
if (container.hasChildNodes() && !document.documentElement.classList.contains('prerender-stale')) {
  hydrateRoot(container, app, {
    onRecoverableError(error) {
      // #419: the prerender leaves lazy parts (the chapters) to the client, as intended.
      if (error instanceof Error && error.message.includes('419')) return;
      console.error(error);
    },
  });
} else {
  container.textContent = '';
  container.dataset.live = '';
  createRoot(container).render(app);
}
