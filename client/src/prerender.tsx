// Build-time entry (vite build --ssr): renders "/" to static HTML so the landing page paints
// before any JavaScript runs. scripts/prerender.mjs injects the result into dist/index.html,
// and main.tsx hydrates it. Lazy parts (the chapters, the app) stay client-only.
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from 'react-router';
import { AppProviders } from './app/providers';
import { routes } from './app/routes';

export async function render(path: string): Promise<string> {
  const handler = createStaticHandler(routes);
  const context = await handler.query(new Request(`http://localhost${path}`));
  if (context instanceof Response) throw new Error(`Cannot prerender ${path}: got a redirect`);
  const router = createStaticRouter(handler.dataRoutes, context);
  return renderToString(
    <StrictMode>
      <AppProviders>
        <StaticRouterProvider router={router} context={context} hydrate={false} />
      </AppProviders>
    </StrictMode>,
  );
}
