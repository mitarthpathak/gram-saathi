# Demo runbook

## 90-second script

| Time | Show | Say or do |
| --- | --- | --- |
| 0–10 s | Open `/?demo=1` on the phone. | “Gram Saathi lets people ask about public schemes in the language they use at home.” |
| 10–30 s | Choose **Hindi + Wagdi** in Demo samples. | Point out the verbatim “आपने कहा” transcript, the Wagdi chip, the sourced PM-KISAN answer, and the fraud warning. |
| 30–45 s | Tap **Marathi** and select its cached sample. | Show that the answer follows the selected language and includes the source and short SMS copy. |
| 45–60 s | Tap **Tamil** and select its cached sample. | Point out the same short answer and safety warning in Tamil. |
| 60–72 s | Tap **English** and select its cached sample. | Show the language selector and answer controls. |
| 72–84 s | Return to the Hindi + Wagdi sample. | If the boli label is wrong, tap **गलत है?**, choose the right variety, then say: “This is why we ask.” The choice is remembered for later voice questions. |
| 84–90 s | Show the home mic and offline indicator. | “The recording can be retried, and saved FAQ answers remain available on a weak connection.” |

Demo mode opens with `?demo=1`; press **D** to toggle it. The four cached sample buttons work without a microphone or network. If a live text or voice request fails while demo mode is on, the UI shows a cached answer in the current language. These are sample answers, not live backend results.

## Pre-demo checklist

- [ ] Pin `GEMINI_CHAT_MODEL` to the model verified for this demo.
- [ ] Run `npm run ingest -w server` and `npm run prewarm -w server`.
- [ ] Commit generated `server/data/*.json` files so the Vercel function includes them.
- [ ] Set `USE_MOCKS=false` and the server-side `GEMINI_API_KEY` in Vercel. Never use a `VITE_` prefix for secrets.
- [ ] Keep `VITE_API_URL` unset for this single-domain deployment; the browser calls `/api` on the same origin. Set `CLIENT_ORIGIN` to the client origin only if the API is deployed on a different origin.
- [ ] Open the deployed URL over HTTPS on the presentation phone and grant microphone permission before the room fills up.
- [ ] Load the app once while online, open the SMS screen in low-data mode to cache FAQ chips, and visit `/?demo=1` so the service worker and sample UI are ready.
- [ ] Check phone volume, battery, network, and that the correct deployment is open. Keep a typed question ready if the room is noisy.

## Manual test matrix

Use these rows for Hindi, Marathi, Tamil, and English. For each row, perform voice and text on both desktop and phone while online, then repeat offline. Record pass/fail and the tested browser/device in the last column.

| Language | Online: desktop voice / text | Online: phone voice / text | Offline: desktop voice / text | Offline: phone voice / text | Result / device notes |
| --- | --- | --- | --- | --- | --- |
| Hindi | ☐ / ☐ | ☐ / ☐ | ☐ / ☐ | ☐ / ☐ | |
| Marathi | ☐ / ☐ | ☐ / ☐ | ☐ / ☐ | ☐ / ☐ | |
| Tamil | ☐ / ☐ | ☐ / ☐ | ☐ / ☐ | ☐ / ☐ | |
| English | ☐ / ☐ | ☐ / ☐ | ☐ / ☐ | ☐ / ☐ | |

Offline voice is a cached demo fallback only in `?demo=1`; it does not submit audio while disconnected. Outside demo mode, confirm the offline banner appears and the request gives a clear retry path. Offline text cannot obtain a new grounded answer; verify that previously cached FAQ chips still open. Online voice checks should include the transcript, dialect label/correction, cited answer, spoken answer, and fraud warning.

## Deployment settings

Follow [DEPLOYMENT.md](DEPLOYMENT.md). For the configured Vercel services the client and server share one origin, so `vercel.json` routes `/api/*` to the server service and all other paths to the client. Set `CLIENT_ORIGIN` to the public client origin if the server's CORS middleware needs to allow a separately hosted client. Do not set `VITE_API_URL` for the same-origin setup.
