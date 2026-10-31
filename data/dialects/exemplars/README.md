# Dialect prompt exemplars

Each `<label>.jsonl` file is intentionally empty until the team contributes consented, native-speaker
material. Files exist for the 14 registry dialects and standard classifier labels. Do not add
synthetic sentences, generated examples, normalized dialect spellings, or Roman transliterations of
Devanagari speech. Preserve the speaker's words and script exactly.

One JSON object per line:

```json
{
  "text": "<verbatim native-speaker words>",
  "hindiMeaning": "<Hindi meaning>",
  "script": "devanagari",
  "speakerAnonId": "<stable anonymous speaker id>",
  "consent": true,
  "notes": "<optional>"
}
```

`script` is `devanagari`, `roman`, `mixed`, or `other`. `consent` must be `true`. Keep each speaker
entirely in the exemplar split or the held-out test split; the evaluation runner rejects overlap.
Rows are selected deterministically, up to `DIALECT_EXEMPLARS_PER_LABEL`, and the prompt's examples
are capped by `DIALECT_EXEMPLAR_TOKEN_BUDGET`. Labels without rows remain zero-shot and are reported
at server startup as `no exemplars`.

The loader and merge command accept the standard classifier label files too. Those are useful as
hard negatives (for example, standard Hindi next to Braj). `mixed_or_uncertain` rows should represent
actual mixed/uncertain recordings supplied by the team, never fabricated examples.
