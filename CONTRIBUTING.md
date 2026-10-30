# Contributing

We are 3–4 people with 24 hours. These rules keep `main` working and merges painless.

## Setup

```bash
nvm use            # Node 22 (see .nvmrc); Node 22.22+ or 24 LTS
npm install
cp .env.example .env
npm run dev        # API on :4000, UI on :5173
```

Everything runs on mock data by default, so no API key is needed to start.

## Branches

- One branch per piece of work, cut from the latest `main`:
  `feature/<area>`, `fix/<thing>`, `docs/<thing>`, `chore/<thing>`.
- Workstream branches (see [docs/TASKS.md](docs/TASKS.md)): `feature/voice-ui`,
  `feature/chat-ui`, `feature/rag-backend`, `feature/eligibility`, `feature/sms`,
  `feature/sms-pwa`, `feature/deploy`.
- Keep branches short-lived: merge something every few hours rather than one big PR at the end.

## Pull requests

```bash
git switch main && git pull
git switch -c feature/voice-ui
# ...work, commit...
git fetch origin && git rebase origin/main      # always rebase before opening or merging a PR
npm run lint && npm run build
git push -u origin feature/voice-ui              # use --force-with-lease after a rebase
```

- **Small PRs into `main`** (aim for under ~300 changed lines), one topic each.
- **Rebase, don't merge `main` into your branch.** Merge with "Squash and merge" (or "Rebase and
  merge") so `main` stays linear.
- Fill in the PR template checklist. CI runs `npm run lint` and `npm run build` on every PR.
- One approval from another workstream is enough. For files you do not own, the owner approves.
- `main` must always run: never merge a PR that breaks `npm run dev` with mocks on.

## Ownership

Each workstream owns specific folders ([docs/TASKS.md](docs/TASKS.md#ownership-map)). Stay
inside yours. If you need a change elsewhere, make it tiny and ask the owner for review, or open
an issue for them.

## The API contract rule

The contract is `shared/src/types.ts` + `docs/API_CONTRACT.md`. They may **only** change through
a PR that:

1. updates **both** files in the same PR (types and docs never disagree),
2. updates the server controller/service stub and the mocks (`server/src/mocks`,
   `client/src/mocks`) and `client/src/lib/api.ts` so everything still runs on mocks,
3. has "contract" in its title and is reviewed by every workstream that uses the endpoint.

Prefer additive changes (new optional fields) over renames or removals, and add a line to the
changelog at the bottom of `docs/API_CONTRACT.md`.

## Secrets

- **Never commit `.env`** (it is git-ignored; only `.env.example` is committed).
- `VITE_*` variables end up in the public JavaScript bundle: **never put a secret in one**. The
  Gemini key is read only by the server.
- If a key leaks (commit, screenshot, chat), revoke it in Google AI Studio right away and make
  a new one. Removing it from git history is not enough.

## Code style

- Prettier formats, ESLint lints: `npm run format` and `npm run lint:fix`. With the recommended
  VS Code extensions this happens on save.
- TypeScript is strict. Unused variables are warnings, so half-finished code still builds.
- Import shared types with `import type { ... } from '@gram-saathi/shared'`. `shared/` holds
  types only; ESLint rejects runtime code there.
- Client imports use the `@/` alias for `client/src` (`import { api } from '@/lib/api'`).
- UI text goes in the feature's `strings.ts` in all four languages, never hard-coded in JSX.
- Mark unfinished work with `TODO(step-2)` or `TODO(step-3)` and a short description.

### Adding things

- **Server module:** `server/src/modules/<name>/{routes,controller,service}.ts`. The controller
  validates with zod and types the response with the contract; the service starts with
  `if (isMocked('<name>')) return mock...`. Mount the router in `server/src/createApp.ts` and add the
  name to `MOCKABLE_MODULES` in `server/src/config/env.ts`.
- **Client feature:** `client/src/features/<name>/` with its components, hooks and `strings.ts`.
  Screens are registered in `client/src/app/router.ts`.
- **Scheme document:** see [data/schemes/README.md](data/schemes/README.md).

## Commit messages

Short, imperative and scoped, e.g. `feat(voice): record audio with MediaRecorder`,
`fix(sms): count ₹ as Unicode`, `docs(contract): add language to tts response`.
