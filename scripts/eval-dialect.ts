import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { env, isMocked, PATHS } from '../server/src/config/env.js';
import {
  classifyDialect,
  dialectPromptVersion,
  getActiveDialectLabels,
} from '../server/src/modules/dialect/classifier.js';
import { getDialectSettings } from '../server/src/modules/dialect/calibration.js';
import { getDialectExemplars } from '../server/src/modules/dialect/exemplars.js';
import {
  assertSpeakerDisjoint,
  computeDialectMetrics,
  DiskEvalCache,
  evalCacheKey,
  mapWithConcurrency,
  parseDialectEvalRows,
  safeAudioPath,
  type DialectEvalRow,
  type DialectPrediction,
} from '../server/src/modules/dialect/evaluation.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const SERVER_DATA = path.join(ROOT, 'server', 'data');

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const testsetFile = path.resolve(args.testset ?? PATHS.dialectTestset);
  const rows = parseDialectEvalRows(readFileSync(testsetFile, 'utf8'), testsetFile);
  const exemplars = getDialectExemplars();
  assertSpeakerDisjoint(rows, exemplars);
  if (rows.length && isMocked('dialect')) {
    throw new Error(
      'Dialect evaluation needs real Gemini calls; set USE_MOCKS=false (or remove dialect from the mock list).',
    );
  }
  if (rows.length && !env.GEMINI_API_KEY) {
    throw new Error('Set GEMINI_API_KEY before evaluating non-empty dialect data.');
  }

  const activeLabels = getActiveDialectLabels();
  const settings = getDialectSettings();
  const model = env.GEMINI_AUDIO_MODEL ?? env.GEMINI_CHAT_MODEL;
  const promptVersion = dialectPromptVersion(activeLabels);
  const cache = new DiskEvalCache(path.join(SERVER_DATA, 'eval-cache', 'dialect-cache.json'));
  let cacheHits = 0;

  const predictions = await mapWithConcurrency(rows, args.concurrency, async (row) => {
    const audioBytes = row.kind === 'audio' ? readAudio(row) : undefined;
    const key = evalCacheKey({
      row,
      audioBytes,
      promptVersion,
      model,
      ensembleSize: settings.ensembleSize,
      minimumVotes: settings.minimumVotes,
      timeoutMs: env.DIALECT_TIMEOUT_MS,
      maxRetries: args.retries,
      thinkingLevel: env.GEMINI_THINKING_LEVEL,
    });
    const cached = await cache.getOrRun(key, async () =>
      runClassifier(row, audioBytes, args.retries),
    );
    if (cached.hit) cacheHits++;
    return cached.value;
  });

  const metrics = computeDialectMetrics(predictions);
  const report = {
    generatedAt: new Date().toISOString(),
    model,
    promptVersion,
    ensembleSize: settings.ensembleSize,
    minimumVotes: settings.minimumVotes,
    activeLabels,
    rows: rows.length,
    cacheHits,
    metrics,
    predictions,
  };
  const outDir = path.join(SERVER_DATA, 'eval-report');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'dialect-eval.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(path.join(outDir, 'dialect-eval.md'), renderMarkdown(report));
  console.log(`Evaluated ${rows.length} row(s); ${cacheHits} cache hit(s).`);
  console.log(
    `Reports: ${path.relative(ROOT, path.join(outDir, 'dialect-eval.md'))} and dialect-eval.json`,
  );
  console.log(renderStatusSuggestions(metrics.perClass, targetFromArgs(process.argv.slice(2))));
}

async function runClassifier(
  row: DialectEvalRow,
  audioBytes: Buffer | undefined,
  retries: number,
): Promise<DialectPrediction> {
  let trace: { selectedLabel: string | null; confidence: 'medium' | 'high' | null } = {
    selectedLabel: null,
    confidence: null,
  };
  const audio = audioBytes
    ? { data: audioBytes.toString('base64'), mimeType: mimeType(row.audioFile!) }
    : undefined;
  await classifyDialect({
    ...(audio && { audio }),
    ...(row.text && { text: row.text }),
    activeLabels: getActiveDialectLabels(),
    onDecision: (value) => {
      trace = value;
    },
    maxRetries: retries,
  });
  return {
    id: row.id,
    goldLabel: row.label,
    predictedLabel: trace.selectedLabel,
    highConfidence: trace.confidence === 'high',
    script: row.script,
    wordCount: row.text ? row.text.trim().split(/\s+/u).filter(Boolean).length : undefined,
    kind: row.kind,
    codeSwitch: row.codeSwitch,
    durationMs: row.durationMs ?? (audioBytes ? wavDurationMs(audioBytes) : undefined),
  };
}

function readAudio(row: DialectEvalRow): Buffer {
  const file = safeAudioPath(PATHS.dialectAudio, row.audioFile!);
  try {
    return readFileSync(file);
  } catch {
    throw new Error(`Audio file for row ${row.id} is missing: ${path.relative(ROOT, file)}`);
  }
}

function mimeType(audioFile: string): string {
  const extension = path.extname(audioFile).toLowerCase();
  const values: Record<string, string> = {
    '.wav': 'audio/wav',
    '.webm': 'audio/webm',
    '.mp3': 'audio/mp3',
    '.m4a': 'audio/mp4',
    '.mp4': 'audio/mp4',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
  };
  const type = values[extension];
  if (!type) throw new Error(`Unsupported audio extension in ${audioFile}`);
  return type;
}

function wavDurationMs(data: Buffer): number | undefined {
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE')
    return undefined;
  let sampleRate: number | undefined;
  let channels: number | undefined;
  let bitsPerSample: number | undefined;
  let dataBytes: number | undefined;
  for (let offset = 12; offset + 8 <= data.length;) {
    const id = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ' && size >= 16 && start + 16 <= data.length) {
      channels = data.readUInt16LE(start + 2);
      sampleRate = data.readUInt32LE(start + 4);
      bitsPerSample = data.readUInt16LE(start + 14);
    } else if (id === 'data') dataBytes = Math.min(size, data.length - start);
    if (size > data.length || start + size <= offset) break;
    offset = start + size + (size % 2);
  }
  const bytesPerSecond =
    sampleRate && channels && bitsPerSample
      ? sampleRate * channels * (bitsPerSample / 8)
      : undefined;
  return bytesPerSecond && dataBytes !== undefined
    ? Math.round((dataBytes / bytesPerSecond) * 1000)
    : undefined;
}

function renderMarkdown(report: {
  generatedAt: string;
  model: string;
  promptVersion: string;
  ensembleSize: number;
  minimumVotes: number;
  rows: number;
  cacheHits: number;
  metrics: ReturnType<typeof computeDialectMetrics>;
}): string {
  const m = report.metrics;
  const lines = [
    '# Dialect evaluation',
    '',
    `Generated: ${report.generatedAt}`,
    `Model: ${report.model}; prompt: ${report.promptVersion}; ensemble: ${report.ensembleSize}; minimum votes: ${report.minimumVotes}`,
    `Rows: ${report.rows}; cache hits: ${report.cacheHits}`,
    '',
    '## Summary',
    '',
    `- Macro-F1: ${percent(m.macroF1)}`,
    `- Answered precision: ${percent(m.answeredPrecision)}`,
    `- Coverage: ${percent(m.coverage)}`,
    `- Abstention rate: ${percent(m.abstentionRate)}`,
    `- Wrong with high confidence: ${m.wrongWithHighConfidence.length}`,
    '',
    '## Per-class metrics',
    '',
    '| Label | Support | Predicted | Precision | Recall | F1 |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(m.perClass).map(
      ([label, value]) =>
        `| ${label} | ${value.support} | ${value.predicted} | ${percent(value.precision)} | ${percent(value.recall)} | ${percent(value.f1)} |`,
    ),
    '',
    '## Confusion matrix (rows = gold; columns = predicted)',
    '',
    markdownMatrix(m.confusionMatrix),
    '',
    '## Confusable pairs',
    '',
    '| Pair | Rows | Accuracy |',
    '| --- | ---: | ---: |',
    ...Object.entries(m.confusablePairs).map(
      ([pair, value]) => `| ${pair} | ${value.rows} | ${percent(value.accuracy)} |`,
    ),
    '',
    '## Breakdowns',
    '',
    ...Object.entries(m.breakdowns).flatMap(([dimension, groups]) => [
      `### ${dimension}`,
      '',
      '| Group | Rows | Coverage | Answered precision | Abstention |',
      '| --- | ---: | ---: | ---: | ---: |',
      ...Object.entries(groups).map(
        ([group, value]) =>
          `| ${group} | ${value.rows} | ${percent(value.coverage)} | ${percent(value.answeredPrecision)} | ${percent(value.abstentionRate)} |`,
      ),
      '',
    ]),
    '## Wrong with high confidence',
    '',
    ...(m.wrongWithHighConfidence.length
      ? m.wrongWithHighConfidence.map(
          (row) => `- ${row.id}: gold=${row.goldLabel}, predicted=${row.predictedLabel}`,
        )
      : ['None.']),
    '',
  ];
  return lines.join('\n');
}

function markdownMatrix(matrix: Record<string, Record<string, number>>): string {
  const columns = [...new Set(Object.values(matrix).flatMap((row) => Object.keys(row)))].sort();
  return [
    `| Gold \\ Predicted | ${columns.join(' | ')} |`,
    `| --- | ${columns.map(() => '---:').join(' | ')} |`,
    ...Object.entries(matrix).map(
      ([gold, row]) => `| ${gold} | ${columns.map((label) => row[label] ?? 0).join(' | ')} |`,
    ),
  ].join('\n');
}

export function renderStatusSuggestions(
  perClass: Record<string, { support: number; precision: number | null }>,
  target: number,
): string {
  const lines = ['testStatus suggestions (only use --write-status to edit registry.json):'];
  for (const [label, stats] of Object.entries(perClass)) {
    const qualifies = stats.support >= 20 && (stats.precision ?? -1) >= target;
    lines.push(
      `- ${label}: ${qualifies ? 'tested' : 'experimental'} (${stats.support} native row(s), precision ${percent(stats.precision)}, target ${percent(target)})`,
    );
  }
  return lines.join('\n');
}

function parseArgs(argv: string[]): { concurrency: number; retries: number; testset?: string } {
  const args = { concurrency: 4, retries: 1, testset: undefined as string | undefined };
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index]!;
    if (value === '--concurrency') args.concurrency = Number(argv[++index]);
    else if (value.startsWith('--concurrency=')) args.concurrency = Number(value.split('=')[1]);
    else if (value === '--retries') args.retries = Number(argv[++index]);
    else if (value.startsWith('--retries=')) args.retries = Number(value.split('=')[1]);
    else if (value === '--testset') args.testset = argv[++index];
    else if (value.startsWith('--testset=')) args.testset = value.slice('--testset='.length);
  }
  if (!Number.isInteger(args.concurrency) || args.concurrency < 1)
    throw new Error('--concurrency must be >= 1');
  if (!Number.isInteger(args.retries) || args.retries < 0 || args.retries > 5)
    throw new Error('--retries must be 0-5');
  return args;
}

function targetFromArgs(argv: string[]): number {
  const raw = argv.find((arg) => arg.startsWith('--target='))?.split('=')[1];
  if (raw === undefined) return 0.9;
  const target = Number(raw);
  return Number.isFinite(target) && target >= 0 && target <= 1 ? target : 0.9;
}

function percent(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
