# Deploying to Vercel

One Vercel project with two [services](https://vercel.com/docs/services) (Beta), defined in
[`vercel.json`](../vercel.json) at the repo root:

| Service  | Root      | Framework                     | Public at                                  | What it serves                                                                                    |
| -------- | --------- | ----------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `server` | `server/` | Express, one Vercel Function  | `/api/*`                                   | The API. It receives the original path (`/api/chat/query`), matching the routes in `createApp.ts` |
| `client` | `client/` | Vite, static files on the CDN | everything else (`/`, `/eligibility`, ...) | The React app. Paths that are not files fall back to `index.html` for client-side routes          |

Both share one domain, so the browser calls `/api/...` on the same origin: no `VITE_API_URL`, no
CORS setup. There are **no service bindings**: the client has no server-side code (it runs in
the browser and goes through the public `/api` rewrite), and the server calls no other service,
only the Gemini API on the internet. If you add a service that calls the API from server-side
code (for example an SSR frontend or a worker), give that caller a binding,
`{ "type": "service", "service": "server", "format": "url", "env": "API_URL" }`, and call
`fetch(new URL('api/health', process.env.API_URL))`.

## Deploy

1. **Import the repository** in Vercel (Add New → Project). Keep the root directory at the repo
   root: Vercel reads `vercel.json` and builds both services.
2. **Environment variables** (Project → Settings → Environment Variables; both services see
   them):
   - Nothing at all gives the mock demo: `USE_MOCKS` defaults to `true`.
   - Real answers: `USE_MOCKS=false` and `GEMINI_API_KEY`, plus any of the optional variables
     in [ARCHITECTURE.md](ARCHITECTURE.md#configuration). Never give a secret a `VITE_` prefix,
     and leave `VITE_API_URL` unset.
   - For the configured same-origin services, `CLIENT_ORIGIN` can remain at its default because
     browser requests do not cross origins. If you host the client separately, set
     `CLIENT_ORIGIN` to that exact public origin and set the client's `VITE_API_URL` to the API
     origin.
3. **Data files.** The function reads generated files from the repository, so build them on your
   machine and commit them:

   ```bash
   npm run ingest -w server    # data/schemes  -> server/data/vectorstore.json
   npm run prewarm -w server   # data/faq      -> server/data/faq.json
   git add server/data && git commit -m "data: rebuild knowledge base and FAQ"
   ```

   Re-run them whenever `data/schemes/` or `data/faq/` change. The eligibility rules in
   `data/eligibility/` are bundled as they are.

4. **Deploy**: push to the branch Vercel watches, or run `vercel deploy`.

## Try it locally first

```bash
vercel dev --local     # both services behind the same routing, http://localhost:3000
```

`--local` needs no Vercel login (environment variables then come from your `.env`). To reproduce
the cloud build exactly, link the project (`vercel link`) and run `vercel build`: the output in
`.vercel/output/` shows the files that go into the function. `npm run dev` still works as before
(Vite proxies `/api` to Express).

## How the server is built, and why

- **Entry point `server/src/app.ts`**: it default-exports the Express app without calling
  `listen()`. Production builds use it because `vercel.json` names it (`entrypoint`); `vercel dev`
  finds it by name, as the first of `app`, `index`, `server`, `src/app`, ... that imports
  express. Keep that name. `server/src/index.ts`, which calls `listen()`, is for `npm run dev`
  and `npm start`.
- **`buildCommand: npm run typecheck`**: Vercel bundles the function itself from `src/app.ts`
  and keeps the repository layout. If the service build produced `server/dist/` (what
  `npm run build` does), Vercel would use `dist/app.js` as the function and flatten the folders,
  and the server would no longer find `data/`. The type check still stops a broken deploy.
- **`includeFiles`** (paths relative to the repo root): `server/data/*.json` (knowledge base and
  FAQ) and `data/eligibility/*.json` (rules) are copied into the function.

## Limits to know

- **In-memory state is per instance**: eligibility wizard sessions, the answer cache and machine
  translations live in one function instance. When Vercel runs several instances, a wizard step
  can land on another one and get `404 SESSION_NOT_FOUND` (the client then restarts the wizard).
  Fine for a demo; for production keep sessions in a shared store (for example Redis from the
  Vercel Marketplace) or make the wizard stateless (a contract change).
- **Request bodies are limited to 4.5 MB** on Vercel Functions (the server itself accepts audio up
  to 10 MB). Short voice questions are far below that: 30 s of Opus is about 100–300 kB.
- **Rate limit**: the AI endpoints allow `RATE_LIMIT_PER_MINUTE` (default 30) requests per IP
  per minute, counted per instance, so a public URL cannot burn your Gemini quota. For a
  stricter, global limit add a Vercel Firewall rate-limit rule on `/api/*`.
- **Read-only filesystem**: `ingest` and `prewarm` run on your machine, never on Vercel.
- **Logs**: Project → Logs. `NODE_ENV=production` logs at `info`; set `LOG_LEVEL=debug` to see
  each Gemini call with timings and token counts.
- **Region**: functions run in Vercel's default region unless you choose one in the project's
  Functions settings; a region near your users (and near Gemini) cuts latency.
- **Node.js**: the root `package.json` asks for Node 22.22 or later. `unpdf` (PDF ingestion only,
  on your machine) prefers Node 24.
