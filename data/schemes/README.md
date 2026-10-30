# Scheme documents

The knowledge base. Every answer must be grounded in these files, and every source card in the
UI points to a section of one of them (`schemeId` + `section`).

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

3. Keep each section short (up to ~150 words). One section becomes one retrievable chunk, and its
   heading is the `section` shown on the source card, so use the standard headings above.
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

## Planned additions

- TODO(step-2): an ingestion script that loads these files, chunks them by `##` heading and
  builds the retrieval index (`modules/rag`). Re-run it after editing documents.
- TODO(step-2): machine-readable eligibility criteria in the front matter for the eligibility
  workstream, e.g.

  ```yaml
  eligibility:
    - { field: ownsLand, equals: true }
    - { field: paysIncomeTax, equals: false }
  ```

## Files

| File                       | Scheme                              | Status                         |
| -------------------------- | ----------------------------------- | ------------------------------ |
| `pm-kisan.md`              | PM-KISAN income support for farmers | Sample, verify before the demo |
| `ayushman-bharat-pmjay.md` | Ayushman Bharat PM-JAY health cover | Sample, verify before the demo |
