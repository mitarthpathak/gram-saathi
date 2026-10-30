## What and why

<!-- One or two sentences. Which task from docs/TASKS.md does this do? -->

## Workstream

- [ ] 1 · Voice + Chat UI
- [ ] 2 · RAG backend
- [ ] 3 · Eligibility + SMS
- [ ] 4 · PWA + Deploy + Demo

## Checklist

- [ ] **Runs locally:** `npm run dev` works and I clicked through every screen I touched
- [ ] `npm run lint` and `npm run build` pass
- [ ] Still works with mocks on (`USE_MOCKS=true`; for UI changes also `VITE_USE_MOCKS=true`)
- [ ] **API contract unchanged**, or updated in **both** `shared/src/types.ts` and
      `docs/API_CONTRACT.md` (plus server stub, mocks and `client/src/lib/api.ts`) and "contract"
      is in the PR title
- [ ] **No secrets:** no `.env`, API keys or tokens in the diff, nothing secret in `VITE_*` variables
- [ ] Only touches folders my workstream owns, or the owner has approved
- [ ] Rebased on the latest `main`

## Screenshots / example output

<!-- UI change: a phone-size screenshot. API change: an example request and response. -->
