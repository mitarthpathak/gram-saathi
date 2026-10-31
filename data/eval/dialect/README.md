# Dialect evaluation data

`testset.jsonl` is intentionally empty until the team supplies consented, native-speaker rows. Do
not have an LLM create transcript, exemplar, or test data. Do not transliterate speech to fabricate
ground truth. Keep speakers disjoint from `data/dialects/exemplars/`.

One JSON object per line:

```json
{
  "id": "<stable-row-id>",
  "kind": "audio",
  "audioFile": "audio/<file>",
  "text": "<verbatim transcript>",
  "script": "devanagari",
  "label": "braj",
  "district": "Mathura",
  "area": "<optional area>",
  "speakerAnonId": "<stable anonymous speaker id>",
  "consent": true,
  "codeSwitch": false,
  "hindiMeaning": "<Hindi meaning>",
  "annotatorConfidence": "unrated",
  "licence": "not-specified"
}
```

`kind` is `audio` or `text`; audio rows require an `audioFile`, while text rows require `text`.
`script` is `devanagari`, `roman`, `mixed`, or `other`. `label` is a registry id or standard
classifier label. `annotatorConfidence` is `low`, `medium`, `high`, or `unrated`. `durationMs` may be
included when known; otherwise WAV duration is read from the audio file and other formats report an
`unknown` duration bucket. Keep the audio file under `audio/` and retain its consent/license record.

The contributor merge command records missing confidence/license metadata explicitly as `unrated`
and `not-specified`; these values do not claim annotation confidence or a public redistribution
license. Confirm a usable license before sharing the dataset outside the team.
