# Owner runbook

## Dialect data needed

The consented exemplar store currently contains **0 examples** for every dialect. Collect at
least **20 consented utterances from native speakers per dialect** before evaluating a label;
20 is a starting floor, not a guarantee of accuracy. Keep test speakers separate from exemplar
speakers. Do not write synthetic examples or normalize a speaker's words.

| Dialect | Current consented exemplars | Suggested minimum |
|---|---:|---:|
| Awadhi | 0 | 20+ |
| Bagri | 0 | 20+ |
| Bhojpuri | 0 | 20+ |
| Braj | 0 | 20+ |
| Bundeli | 0 | 20+ |
| Dhundhari/Jaipuri | 0 | 20+ |
| Harauti | 0 | 20+ |
| Haryanvi | 0 | 20+ |
| Malvi | 0 | 20+ |
| Marwari | 0 | 20+ |
| Mewari | 0 | 20+ |
| Mewati | 0 | 20+ |
| Shekhawati | 0 | 20+ |
| Wagdi | 0 | 20+ |

The Braj and Wagdi registry entries already exist and are experimental with Hindi as their base
language. No dialect selector is present in the current client; the API accepts a confirmed
`dialectHint`. The chat prompt reads the existing consented store through
`renderPromptExemplars`, bounded by `DIALECT_EXEMPLARS_PER_LABEL` and
`DIALECT_EXEMPLAR_TOKEN_BUDGET`. Empty labels contribute no examples.

See `data/dialects/exemplars/README.md` and `docs/ARCHITECTURE.md` for the consent and evaluation
format. The live dialect classifier remains best-effort until native speakers review it.
