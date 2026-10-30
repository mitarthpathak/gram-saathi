# Scheme documents

The knowledge base. Every answer must be grounded in these files, and every source card in the
UI points to a section of one of them (`schemeId` + `section`).

> **All seven files here are SAMPLES** (`sample: true` in their front matter and a banner
> comment): hackathon summaries written from public information. Replace each one with the
> official scheme text, set `sample: false` and `verified: true`, then re-run
> `npm run ingest -w server`. The server warns at startup while the knowledge base contains
> sample documents.

## Add a scheme

1. Create `data/schemes/<scheme-id>.md`. The file name (without `.md`) is the `schemeId` used by
   the API: lowercase words joined by dashes, e.g. `pm-ujjwala.md` → `pm-ujjwala`.
2. Start with front matter, then one `##` section per topic:

   ```markdown
   ---
   schemeId: pm-ujjwala
   schemeName: <official scheme name>
   ministry: <ministry or department>
   officialUrl: <official .gov.in page>
   helpline: '<official helpline number>'
   tags: [<topic>, <who it is for>]
   languages: [en]
   sample: false # true for placeholder text that must be replaced
   verified: true # true only after checking every fact on officialUrl
   lastVerified: <YYYY-MM-DD>
   ---

   # <official scheme name>

   ## Overview

   ## Benefits

   ## Eligibility

   ## How to apply

   ## Documents needed

   ## Helpline
   ```

3. Keep each section focused. Each section becomes one or more retrievable chunks (long
   sections are split at about 600 tokens), and its heading is the `section` shown on the source
   card, so use the standard headings above.
4. Use plain, factual language: amounts with units ("₹6,000 per year"), who qualifies, where to
   apply. No opinions, no advice.

## Rules

- **Official sources only:** the scheme's `.gov.in` site, guidelines, gazette notifications, PIB
  releases. Put the link in `officialUrl`, and set `verified: true` and `lastVerified` only after
  checking every fact there.
- If something is unclear, leave it out. The assistant then answers "not found" instead of
  guessing.
- English is fine: answers are generated in the user's language. Text in other languages is
  welcome as extra files or sections.
- No personal data.

## Ingestion

```bash
npm run ingest -w server              # needs GEMINI_API_KEY
npm run ingest -w server -- --dry-run # chunk only: check the split without any API call
```

The script reads every `.md`, `.markdown`, `.txt` and `.pdf` file here (except this README),
splits it by `##` / `###` section and then into chunks of about 600 tokens with a small overlap,
embeds the chunks with Gemini and writes `server/data/vectorstore.json`. Re-run it after every
change here; the server warns when the documents changed since the last run. PDFs have no
headings, so a PDF becomes one "Overview" section: prefer Markdown with the headings above.
`schemeId` defaults to the file name and `schemeName` to the first `#` heading.

Eligibility rules are not in these files: they live in `data/eligibility/` (see its README).

## Files

| File                         | Scheme                                       | Status                             |
| ---------------------------- | -------------------------------------------- | ---------------------------------- |
| `pm-kisan.md`                | PM-KISAN income support for farmers          | SAMPLE: replace with official text |
| `ayushman-bharat-pmjay.md`   | Ayushman Bharat PM-JAY health cover          | SAMPLE: replace with official text |
| `atal-pension-yojana.md`     | Atal Pension Yojana                          | SAMPLE: replace with official text |
| `pm-suraksha-bima-yojana.md` | PM Suraksha Bima Yojana (accident insurance) | SAMPLE: replace with official text |
| `pm-ujjwala-yojana.md`       | PM Ujjwala Yojana (LPG connections)          | SAMPLE: replace with official text |
| `mgnrega.md`                 | MGNREGA (100 days of rural wage work)        | SAMPLE: replace with official text |
| `pmay-gramin.md`             | PM Awas Yojana Gramin (rural housing)        | SAMPLE: replace with official text |
