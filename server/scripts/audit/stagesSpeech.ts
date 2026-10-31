/** Stages F (speech in), G (speech out) and H (optional browser end-to-end test). */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { LanguageCode, QueryResponse, TtsResponse } from '@gram-saathi/shared';
import { env, isMocked } from '../../src/config/env';
import { getMessage } from '../../src/modules/chat/messages';
import { getDialectRegistry } from '../../src/modules/dialect/registry';
import {
  aggregateStatus,
  characterErrorRate,
  decodeDataUrl,
  distribution,
  excerpt,
  formatDistribution,
  parseWav,
  plausibleDuration,
  silentWav,
} from './checks';
import {
  asMode,
  mockedModulesText,
  NO_KEY_REASON,
  runStage,
  sessionId,
  stageMode,
  type WorkerContext,
} from './context';
import { AUDIT_LANGUAGES } from './goldset';
import { errorCode, isErrorBody, type ApiResult } from './transport';
import type { Check, StageResult, Status } from './types';

export const SYNTHETIC_DISCLAIMER = 'does not prove performance on real village speakers';

interface ClipLabel {
  file: string;
  transcript: string;
  languageCode: LanguageCode;
  dialectId: string | null;
  speakerConsent: boolean;
}

function loadClipLabels(repoRoot: string): ClipLabel[] {
  const file = path.join(repoRoot, 'eval/audio/labels.json');
  if (!existsSync(file)) return [];
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  return Array.isArray(parsed) ? (parsed as ClipLabel[]) : [];
}

function voiceExcerpt(result: ApiResult<QueryResponse>): string {
  if (!result.body || isErrorBody(result.body))
    return `HTTP ${result.status} ${errorCode(result) ?? ''}`.trim();
  const body = result.body;
  return `transcript “${excerpt(body.transcript ?? '', 100)}”, language ${body.detectedLanguage}, dialect ${body.dialect?.id ?? 'null'}; answer “${excerpt(body.answer, 100)}”`;
}

// ---------------------------------------------------------------------------
// Stage F: speech in
// ---------------------------------------------------------------------------

export function stageF(ctx: WorkerContext): Promise<StageResult> {
  const mode = stageMode(['voice', 'chat', 'rag']);
  return runStage(
    'F',
    'Speech in (POST /api/voice/query)',
    mode === 'none' ? 'none' : mode,
    async () => {
      const checks: Check[] = [];
      const labels = loadClipLabels(ctx.repoRoot);
      const registryIds = new Set(getDialectRegistry().map((entry) => entry.id));

      if (mode === 'none') {
        return {
          checks: [],
          status: 'NOT-TESTED',
          reason: `${NO_KEY_REASON} ${labels.length ? `${labels.length} labelled clip(s) are waiting in eval/audio.` : 'No labelled clips exist in eval/audio either.'}`,
        };
      }

      if (mode === 'mock') {
        // Reproduces what a spoken question does in mock mode: the audio is ignored.
        for (const language of AUDIT_LANGUAGES) {
          const result = await ctx.transport.voice(
            { language, sessionId: sessionId(`f-mock-${language}`) },
            { bytes: silentWav(1500), mimeType: 'audio/wav', fileName: 'silence.wav' },
          );
          const body = result.body && !isErrorBody(result.body) ? result.body : undefined;
          checks.push({
            id: `F-mock-${language}`,
            title: `${language}: 1.5 s of silence sent to the mock voice endpoint`,
            status: 'MOCK-ONLY',
            detail: body?.transcript
              ? `The mock returned a canned transcript for silence, so every spoken question gets a canned scheme answer regardless of what was said. ${mockedModulesText(['voice'])}`
              : `No transcript returned (HTTP ${result.status}). ${mockedModulesText(['voice'])}`,
            evidence: [voiceExcerpt(result)],
            data: {
              transcript: body?.transcript,
              sources: body?.sources.map((source) => source.schemeId),
            },
          });
          ctx.regional.push({
            row: language,
            column: 'understandsSpeech',
            status: 'MOCK-ONLY',
            evidence: `results.json stages.F check F-mock-${language}`,
          });
        }
        return { checks };
      }

      // Real mode: labelled clips first.
      const usable = labels.filter(
        (label) =>
          label.speakerConsent === true &&
          existsSync(path.join(ctx.repoRoot, 'eval/audio', label.file)),
      );
      const skipped = labels.length - usable.length;
      if (usable.length > 0) {
        const perRow = new Map<
          string,
          { cer: number[]; statuses: Status[]; dialectAgree: boolean[] }
        >();
        for (const label of usable) {
          const bytes = readFileSync(path.join(ctx.repoRoot, 'eval/audio', label.file));
          const result = await ctx.transport.voice(
            { sessionId: sessionId('f-clip') },
            { bytes, mimeType: 'audio/wav', fileName: label.file },
          );
          ctx.latencies.voice.push(result.ms);
          const body = result.body && !isErrorBody(result.body) ? result.body : undefined;
          const cer =
            body?.transcript !== undefined
              ? characterErrorRate(label.transcript, body.transcript)
              : 1;
          const languageOk = body?.detectedLanguage === label.languageCode;
          const dialectOk = (body?.dialect?.id ?? null) === (label.dialectId ?? null);
          const status: Status = !body
            ? 'FAIL'
            : cer <= 0.15 && languageOk
              ? 'PASS'
              : cer <= 0.35
                ? 'PARTIAL'
                : 'FAIL';
          const row =
            label.dialectId && registryIds.has(label.dialectId)
              ? label.dialectId
              : label.languageCode;
          const bucket = perRow.get(row) ?? { cer: [], statuses: [], dialectAgree: [] };
          bucket.cer.push(cer);
          bucket.statuses.push(status);
          bucket.dialectAgree.push(dialectOk);
          perRow.set(row, bucket);
          checks.push({
            id: `F-clip-${label.file}`,
            title: `Clip ${label.file} (${label.dialectId ?? label.languageCode})`,
            status,
            detail: `CER ${cer.toFixed(3)} (PASS ≤ 0.15 with the right language, PARTIAL ≤ 0.35); language ${body?.detectedLanguage ?? '-'} vs ${label.languageCode}; dialect ${body?.dialect?.id ?? 'null'} vs ${label.dialectId ?? 'null'}.`,
            evidence: [`eval/audio/${label.file}`, voiceExcerpt(result)],
            data: { cer, languageOk, dialectOk },
          });
        }
        for (const [row, bucket] of perRow) {
          ctx.regional.push({
            row,
            column: 'understandsSpeech',
            status: aggregateStatus(bucket.statuses),
            evidence: `eval/audio clips: CER ${formatDistribution(distribution(bucket.cer))}`,
          });
          const agree = bucket.dialectAgree.filter(Boolean).length;
          ctx.regional.push({
            row,
            column: 'identifiesDialect',
            status: agree === bucket.dialectAgree.length ? 'PASS' : agree > 0 ? 'PARTIAL' : 'FAIL',
            evidence: `eval/audio clips: dialect label agreement ${agree}/${bucket.dialectAgree.length}`,
          });
        }
        if (skipped > 0) {
          checks.push({
            id: 'F-clips-skipped',
            title: 'Clips skipped',
            status: 'NOT-TESTED',
            detail: `${skipped} label(s) skipped: missing file or speakerConsent is not true.`,
            evidence: ['eval/audio/labels.json'],
          });
        }
      } else {
        checks.push({
          id: 'F-real-speakers',
          title: 'Real-speaker speech recognition (languages and dialects)',
          status: 'NOT-TESTED',
          detail:
            'No consented, labelled clips in eval/audio (see eval/audio/README.md). Real-speaker and dialect speech recognition stay untested until the owner records them.',
          evidence: ['eval/audio/README.md'],
        });
        // Synthetic clips: machine speech of repo questions. Weak evidence by design.
        const ttsReady = !isMocked('tts') && Boolean(env.GEMINI_TTS_MODEL);
        if (!ttsReady) {
          checks.push({
            id: 'F-synthetic',
            title: 'Synthetic clips',
            status: 'NOT-TESTED',
            detail:
              'Server TTS is not available (tts mocked or no TTS model), so no synthetic clip could be generated.',
            evidence: [],
          });
        } else {
          for (const language of AUDIT_LANGUAGES) {
            const statuses: number[] = [];
            for (const faqId of ['pm-kisan-amount', 'pmjay-cover']) {
              const q = ctx.gold.questions.find(
                (item) => item.faqId === faqId && item.language === language,
              );
              if (!q) continue;
              const tts = await ctx.transport.tts({ text: q.text, language });
              const audio =
                tts.body && !isErrorBody(tts.body) && tts.body.audioUrl
                  ? decodeDataUrl(tts.body.audioUrl)
                  : undefined;
              if (!audio) {
                checks.push({
                  id: `F-synthetic-${language}-${faqId}`,
                  title: `Synthetic ${language} clip`,
                  status: 'NOT-TESTED',
                  detail: `TTS returned no audio (HTTP ${tts.status}).`,
                  evidence: [],
                });
                continue;
              }
              const result = await ctx.transport.voice(
                { sessionId: sessionId('f-syn') },
                {
                  bytes: audio.bytes,
                  mimeType: audio.mimeType,
                  fileName: `${language}-${faqId}.wav`,
                },
              );
              ctx.latencies.voice.push(result.ms);
              const body = result.body && !isErrorBody(result.body) ? result.body : undefined;
              const cer =
                body?.transcript !== undefined ? characterErrorRate(q.text, body.transcript) : 1;
              statuses.push(cer);
              checks.push({
                id: `F-synthetic-${language}-${faqId}`,
                title: `Synthetic ${language} clip of “${q.text}”`,
                status: 'SYNTHETIC-ONLY',
                detail: `CER ${cer.toFixed(3)}; language ${body?.detectedLanguage ?? '-'} (expected ${language}). Machine-generated audio: ${SYNTHETIC_DISCLAIMER}.`,
                evidence: [voiceExcerpt(result)],
                data: { cer },
              });
            }
            ctx.regional.push({
              row: language,
              column: 'understandsSpeech',
              status: statuses.length ? 'SYNTHETIC-ONLY' : 'NOT-TESTED',
              evidence: statuses.length
                ? `synthetic clips CER ${formatDistribution(distribution(statuses))} (${SYNTHETIC_DISCLAIMER})`
                : 'no synthetic clip',
            });
          }
          checks.push({
            id: 'F-synthetic-dialects',
            title: 'Synthetic dialect clips',
            status: 'NOT-TESTED',
            detail:
              'Not generated: the repo has no consented dialect sentences to synthesize, and dialect sentences must not be invented.',
            evidence: ['data/dialects/exemplars/*.jsonl (empty)'],
          });
        }
      }
      return { checks };
    },
  );
}

// ---------------------------------------------------------------------------
// Stage G: speech out
// ---------------------------------------------------------------------------

export function stageG(ctx: WorkerContext): Promise<StageResult> {
  const mode = stageMode(['tts']);
  return runStage('G', 'Speech out (POST /api/tts)', mode === 'none' ? 'none' : mode, async () => {
    if (mode === 'none') return { checks: [], status: 'NOT-TESTED', reason: NO_KEY_REASON };
    const checks: Check[] = [];
    const outDir = path.join(ctx.repoRoot, 'eval/out/tts');
    mkdirSync(outDir, { recursive: true });
    const sizes: number[] = [];

    const speak = async (row: string, text: string, language: LanguageCode, dialectId?: string) => {
      const result = await ctx.transport.tts(
        dialectId ? { text, language, dialectId } : { text, language },
      );
      ctx.latencies.tts.push(result.ms);
      const body =
        result.body && !isErrorBody(result.body)
          ? (result.body as TtsResponse & { basis?: string })
          : undefined;
      if (mode === 'mock') {
        checks.push({
          id: `G-${row}`,
          title: `${row}: speech for a fixed sentence`,
          status: 'MOCK-ONLY',
          detail: `audioUrl ${body?.audioUrl === null ? 'null (browser voice expected)' : 'present'}. ${mockedModulesText(['tts'])}`,
          evidence: [`HTTP ${result.status}`],
        });
        ctx.regional.push({
          row,
          column: 'speaksReply',
          status: 'MOCK-ONLY',
          evidence: `results.json stages.G check G-${row}`,
        });
        ctx.regional.push({
          row,
          column: 'accentMatches',
          status: 'MOCK-ONLY',
          evidence: 'no server audio in mock mode',
        });
        return;
      }
      const problems: string[] = [];
      const audio = body?.audioUrl ? decodeDataUrl(body.audioUrl) : undefined;
      let fileNote = '';
      if (!body) problems.push(`HTTP ${result.status} ${errorCode(result) ?? ''}`.trim());
      else if (!body.audioUrl) problems.push('audioUrl is null (server TTS returned no audio)');
      else if (!audio) problems.push('audioUrl is not a base64 data URL');
      else {
        sizes.push(audio.bytes.length);
        const isWav = audio.mimeType.includes('wav');
        const fileName = `${row}.${isWav ? 'wav' : 'bin'}`;
        writeFileSync(path.join(outDir, fileName), audio.bytes);
        fileNote = `eval/out/tts/${fileName}`;
        if (isWav) {
          const info = parseWav(audio.bytes);
          if (!info.valid) problems.push(`invalid WAV: ${info.error}`);
          else {
            const duration = plausibleDuration(text, info.durationSec ?? 0);
            if (!duration.plausible)
              problems.push(
                `implausible duration ${info.durationSec?.toFixed(2)} s for ${[...text].length} characters (${duration.charsPerSecond.toFixed(1)} chars/s)`,
              );
            fileNote += ` (${info.sampleRate} Hz, ${info.channels} ch, ${info.bitsPerSample}-bit, ${info.durationSec?.toFixed(2)} s, ${Math.round(audio.bytes.length / 1024)} KB)`;
          }
        } else
          fileNote += ` (${audio.mimeType}, ${Math.round(audio.bytes.length / 1024)} KB; header not checked)`;
      }
      const status: Status = problems.length ? 'FAIL' : 'PASS';
      checks.push({
        id: `G-${row}`,
        title: `${row}: server speech for “${excerpt(text, 60)}”`,
        status,
        detail: `${problems.length ? `Problems: ${problems.join('; ')}.` : 'Audio returned with a valid header and a plausible length.'} Latency ${result.ms} ms.${body?.basis ? ` basis: ${body.basis}.` : dialectId ? ' No basis field in the response.' : ''} Pronunciation and accent are for a human to judge.`,
        evidence: fileNote ? [fileNote] : [`HTTP ${result.status}`],
        data: { basis: body?.basis, ms: result.ms },
      });
      ctx.regional.push({
        row,
        column: 'speaksReply',
        status,
        evidence: fileNote || `results.json stages.G check G-${row}`,
      });
      ctx.regional.push({
        row,
        column: 'accentMatches',
        status: status === 'PASS' ? 'NEEDS-HUMAN' : 'NOT-TESTED',
        evidence: status === 'PASS' ? `listen to ${fileNote.split(' ')[0]}` : 'no audio to judge',
      });
    };

    for (const language of AUDIT_LANGUAGES) {
      await speak(language, getMessage(language, 'notFoundSms'), language);
    }
    if (mode === 'real') {
      for (const entry of getDialectRegistry()) {
        const text =
          ctx.shared.dialectAnswers.get(entry.id) ??
          ctx.shared.standardAnswerHi ??
          getMessage('hi', 'notFoundSms');
        await speak(entry.id, text, entry.parentLanguage, entry.id);
      }
      if (sizes.length > 0) {
        checks.push({
          id: 'G-human',
          title: 'Pronunciation and accent',
          status: 'NEEDS-HUMAN',
          detail:
            'Code cannot judge pronunciation, naturalness or accent. Listen to eval/out/tts/*.wav (git-ignored).',
          evidence: ['eval/out/tts/'],
        });
      }
    } else {
      for (const entry of getDialectRegistry()) {
        ctx.regional.push({
          row: entry.id,
          column: 'speaksReply',
          status: 'MOCK-ONLY',
          evidence: 'mock TTS returns no audio for any input',
        });
        ctx.regional.push({
          row: entry.id,
          column: 'accentMatches',
          status: 'MOCK-ONLY',
          evidence: 'no server audio in mock mode',
        });
      }
    }
    return { checks, data: { sizesKb: sizes.map((size) => Math.round(size / 1024)) } };
  });
}

// ---------------------------------------------------------------------------
// Stage H: optional browser end-to-end test
// ---------------------------------------------------------------------------

export function stageH(ctx: WorkerContext): Promise<StageResult> {
  return runStage('H', 'Browser end-to-end mic test (optional)', 'none', async () => {
    const clientUrl = process.env.AUDIT_CLIENT_URL;
    let playwrightAvailable = false;
    try {
      require.resolve('playwright');
      playwrightAvailable = true;
    } catch {
      playwrightAvailable = false;
    }
    if (!playwrightAvailable || !clientUrl) {
      return {
        checks: [],
        status: 'NOT-TESTED',
        reason:
          [
            playwrightAvailable
              ? undefined
              : 'Playwright is not installed (optional: `npm i -D playwright -w server` and `npx playwright install chromium`)',
            clientUrl
              ? undefined
              : 'AUDIT_CLIENT_URL is not set (the running client, e.g. http://localhost:5173, served against a real-mode API)',
          ]
            .filter(Boolean)
            .join('; ') + '.',
      };
    }
    const { runBrowserMicTest } = await import('./e2e.js');
    const checks = await runBrowserMicTest(clientUrl, ctx.repoRoot);
    return { checks };
  });
}
