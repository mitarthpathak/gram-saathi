/**
 * Renders the same fixed, neutral sentence in every configured voice, for a person to audition:
 *
 *   npm run tts:samples -w server                  language voices with GEMINI_TTS_MODEL,
 *                                                  dialect voices with GEMINI_TTS_DIALECT_MODEL
 *   npm run tts:samples -w server -- --both-models also render language voices with the other model
 *
 * The sentence is the existing greeting of each language from src/modules/chat/messages.ts (it
 * carries no scheme facts). Dialect voices read their parent language's greeting: no dialect text
 * is invented here. Files go to eval/out/tts/samples/ (git-ignored) with an index.md to note what
 * the listener heard. Needs GEMINI_API_KEY; calls the API even when USE_MOCKS is on.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { LanguageCode } from '@gram-saathi/shared';
import { env } from '../src/config/env';
import { classifyGeminiError, synthesizeAudio } from '../src/lib/geminiClient';
import { encodeWav, isWav, parseWav, pcmDurationSeconds } from '../src/lib/wav';
import { MESSAGES } from '../src/modules/chat/messages';
import { getDialectEntry } from '../src/modules/dialect/registry';
import { getTtsVoices, type TtsVoiceEntry } from '../src/modules/tts/voices';

const OUT_DIR = path.resolve(__dirname, '../../eval/out/tts/samples');

interface Job {
  source: string;
  language: LanguageCode;
  entry: TtsVoiceEntry;
  model: string;
}

const off = (model: string) => !model || model.toLowerCase() === 'none';

/** Set once the API has refused the configured rate, so later voices go straight to 24000. */
let rateRejected = false;

async function render(job: Job, configuredRate: number): Promise<{ wav: Buffer; rate: number }> {
  const sampleRate = rateRejected ? 24_000 : configuredRate;
  const call = async (rate: number) => {
    const result = await synthesizeAudio({
      model: job.model,
      text: MESSAGES[job.language].greeting,
      voice: (job.entry.voiceId ?? job.entry.voice) as string,
      style: env.TTS_STYLE || undefined,
      sampleRate: rate,
      timeoutMs: env.TTS_TIMEOUT_MS ?? env.GEMINI_TTS_TIMEOUT_MS,
      maxRetries: 2,
    });
    const wav = isWav(result.audio)
      ? result.audio
      : encodeWav({ sampleRate: rate, channels: 1, bitsPerSample: 16, data: result.audio });
    return { wav, rate };
  };
  try {
    return await call(sampleRate);
  } catch (error) {
    if (sampleRate === 24_000 || classifyGeminiError(error)?.kind !== 'bad_request') throw error;
    console.warn(`  sample rate ${sampleRate} rejected; retrying at 24000`);
    const retried = await call(24_000);
    rateRejected = true;
    return retried;
  }
}

async function main(): Promise<void> {
  if (!env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set. Add it to .env (never commit it) and run again.');
    process.exitCode = 1;
    return;
  }
  if (off(env.GEMINI_TTS_MODEL)) {
    console.error('GEMINI_TTS_MODEL is "none": set a TTS model to render samples.');
    process.exitCode = 1;
    return;
  }
  const bothModels = process.argv.includes('--both-models');
  const dialectModel = off(env.GEMINI_TTS_DIALECT_MODEL)
    ? env.GEMINI_TTS_MODEL
    : env.GEMINI_TTS_DIALECT_MODEL;
  const voices = getTtsVoices();

  const jobs: Job[] = [];
  for (const language of Object.keys(voices.languages) as LanguageCode[]) {
    const entry = voices.languages[language];
    jobs.push({ source: `languages.${language}`, language, entry, model: env.GEMINI_TTS_MODEL });
    if (bothModels && dialectModel !== env.GEMINI_TTS_MODEL) {
      jobs.push({ source: `languages.${language}`, language, entry, model: dialectModel });
    }
  }
  for (const [id, entry] of Object.entries(voices.dialects)) {
    const dialect = getDialectEntry(id);
    if (!dialect) {
      console.warn(`Skipping dialects.${id}: not a registry dialect id.`);
      continue;
    }
    jobs.push({
      source: `dialects.${id}`,
      language: dialect.parentLanguage,
      entry,
      model: dialectModel,
    });
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const rows: string[] = [];
  let failures = 0;
  for (const job of jobs) {
    const voice = (job.entry.voiceId ?? job.entry.voice) as string;
    const fileName = `${job.source.replace('.', '-')}__${voice}__${job.model}.wav`.replace(
      /[^\w.-]+/g,
      '_',
    );
    process.stdout.write(`${job.source} (${voice}, ${job.model}) ... `);
    try {
      const { wav, rate } = await render(job, env.GEMINI_TTS_SAMPLE_RATE);
      writeFileSync(path.join(OUT_DIR, fileName), wav);
      const pcm = parseWav(wav);
      const seconds = pcm ? pcmDurationSeconds(pcm).toFixed(1) : '?';
      console.log(`${seconds} s`);
      rows.push(
        `| ${job.source} | \`${voice}\` | ${job.entry.status} | ${job.model} | ${rate} | ${seconds} | [${fileName}](${fileName}) | | |`,
      );
    } catch (error) {
      failures += 1;
      const kind = classifyGeminiError(error)?.kind ?? 'error';
      console.log(`FAILED (${kind})`);
      rows.push(
        `| ${job.source} | \`${voice}\` | ${job.entry.status} | ${job.model} | | | FAILED (${kind}) | | |`,
      );
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(
    path.join(OUT_DIR, 'index.md'),
    [
      '# TTS samples for auditioning',
      '',
      `Rendered ${today} by \`npm run tts:samples -w server\`. Each file reads the existing greeting of`,
      'its language from server/src/modules/chat/messages.ts. Dialect voices read the parent-language',
      'greeting. A native speaker fills in the last two columns; only then may a voice be marked',
      '"auditioned" in server/src/config/tts-voices.json.',
      '',
      '| voice entry | voice | status | model | Hz | seconds | file | heard by | verdict |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...rows,
      '',
    ].join('\n'),
    'utf8',
  );
  console.log(
    `\n${jobs.length - failures}/${jobs.length} rendered into ${path.relative(process.cwd(), OUT_DIR)}`,
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
