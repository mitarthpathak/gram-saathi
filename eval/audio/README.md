# Real-speaker clips for the pipeline audit

`npm run audit -w server` (Stage F, and Stage H when enabled) sends every clip listed in
`eval/audio/labels.json` to `POST /api/voice/query` and reports the character error rate (CER) of
the transcript, whether the language was detected correctly and whether the dialect was
identified. Until real clips exist, speech recognition for real village speakers and for every
dialect stays **NOT-TESTED**. Machine-generated (synthetic) clips are only weak evidence and do not
replace these.

## What to record

- **10 clips per language or dialect** you want to measure: `hi`, `mr`, `ta`, `en`, and any registry
  dialect (`data/dialects/registry.json`) for which you have native speakers.
- Several different speakers per row (at least 3), each 5–10 seconds, one natural question about a
  government scheme per clip, spoken the way the speaker normally talks. Do not script dialect
  sentences for them and do not "correct" what they say.
- A quiet room is fine, but also include a few clips with normal village background noise.

## Format

- 16 kHz, mono, 16-bit PCM WAV. Convert with:
  `ffmpeg -i input.m4a -ac 1 -ar 16000 -sample_fmt s16 output.wav`
- File name: `<row>_<speaker>_<nn>.wav`, where `<row>` is the language code or registry dialect id
  and `<speaker>` is an anonymous id, for example `hi_spk01_01.wav` or `bhojpuri_spk04_03.wav`.
- WAV files are git-ignored (`eval/audio/*.wav`): voices are personal data. Share them privately.

## labels.json

One entry per clip (see `labels.example.json` for the shape):

```json
[
  {
    "file": "hi_spk01_01.wav",
    "transcript": "<the speaker's exact words, in the script they would write>",
    "languageCode": "hi",
    "dialectId": null,
    "speakerConsent": true
  }
]
```

- `transcript`: verbatim, written down by a native speaker who listened to the clip. Keep dialect
  words and spellings; never normalize to standard Hindi.
- `languageCode`: `hi`, `mr`, `ta` or `en` (the parent language for a dialect, e.g. `hi`).
- `dialectId`: a registry id such as `"bhojpuri"`, or `null` for standard speech.
- `speakerConsent`: must be `true`. Clips without it are skipped.

## Consent

Record each speaker's informed consent (what the recording is for, who will hear it, how long it is
kept, how to withdraw) **before** recording, and keep that consent record outside this repository.
Delete a speaker's clips and label rows when they ask. Do not put names, phone numbers or villages
in file names or labels. Keep a speaker's clips in either the exemplar set
(`data/dialects/exemplars`) or this test set, never both.

## Run

```bash
npm run audit -w server            # real mode needs USE_MOCKS=false and GEMINI_API_KEY in .env
```

Results land in `docs/PIPELINE_AUDIT.md` (Stage F and the regional readiness matrix).
