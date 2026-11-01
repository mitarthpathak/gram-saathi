# Scheme documents

This directory contains the source library for chat retrieval. Production ingestion accepts a
document only when its front matter says `sample: false`, `verified: true`, and links to an HTTPS
government source (or PFRDA). The server blocks answers from old or unverified vector stores.

Six documents currently contain facts checked against the linked official pages. The PMAY-G file
is still a sample and is skipped; PMAY-G questions will correctly return “not in the documents”
until a current official source has been reviewed.

## Add or update a source

Create `data/schemes/<scheme-id>.md` using this front matter:

```markdown
---
schemeId: pm-ujjwala
schemeName: <official scheme name>
ministry: <ministry or department>
officialUrl: <secure official source URL>
sourceUrl: <official source page checked for the facts>
accessDate: <YYYY-MM-DD>
tags: [<topic>, <who it is for>]
languages: [en]
sample: false
verified: true
lastVerified: <YYYY-MM-DD>
---
```

Use one `##` section per topic. Keep sections focused and use plain factual language. Include
only facts checked against `officialUrl`; omit anything unclear. Never include personal data.

## Ingestion

```bash
npm run ingest -w server              # verified official documents only; needs GEMINI_API_KEY
npm run ingest -w server -- --dry-run # check chunking without an API call
```

The script skips sample, unverified or non-official files. It splits approved sources into
retrievable chunks, embeds them with Gemini and writes `server/data/vectorstore.json`. Re-run it
after each source edit. Restart the server after ingesting.

The client and server mocks are synthetic demo data. They are labelled as demo data in the app
and must not be used to verify scheme eligibility or benefits.

## Files

| File                         | Scheme                                 | Source status                                |
| ---------------------------- | -------------------------------------- | -------------------------------------------- |
| `pm-kisan.md`                | PM-KISAN income support for farmers    | Verified against PM-KISAN portal             |
| `ayushman-bharat-pmjay.md`   | PM-JAY senior-citizen benefit, age 70+ | Verified against NHA FAQ                     |
| `atal-pension-yojana.md`     | Atal Pension Yojana                    | Verified against PFRDA FAQ                   |
| `pm-suraksha-bima-yojana.md` | PMSBY accident insurance               | Verified against Jan Suraksha FAQ            |
| `pm-ujjwala-yojana.md`       | PM Ujjwala Yojana (LPG connections)    | Verified against PMUY FAQ                    |
| `mgnrega.md`                 | MGNREGS employment guarantee           | Verified against official scheme portal      |
| `pmay-gramin.md`             | PM Awas Yojana Gramin (rural housing)  | Sample; excluded until current source review |
