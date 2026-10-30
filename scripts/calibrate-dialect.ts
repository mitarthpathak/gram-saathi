import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { env, isMocked, PATHS } from '../server/src/config/env.js';
import {
  classifyDialect,
  dialectPromptVersion,
  getActiveDialectLabels,
  selectedClassifierLabel,
} from '../server/src/modules/dialect/classifier.js';
import {
  chooseCalibration,
  type CalibrationScore,
} from '../server/src/modules/dialect/calibration.js';
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
const CACHE_FILE = path.join(ROOT, 'server', 'data', 'eval-cache', 'dialect-cache.json');
const REGISTRY_FILE = PATHS.dialects;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rows = parseDialectEvalRows(readFileSync(args.testset ?? PATHS.dialectTestset, 'utf8'));
  assertSpeakerDisjoint(rows, getDialectExemplars());
  const activeLabels = getActiveDialectLabels();
  const classCounts = Object.fromEntries(activeLabels.map((label) => [label, 0]));
  for (const row of rows) classCounts[row.label] = (classCounts[row.label] ?? 0) + 1;
  const underSampled = Object.entries(classCounts).filter(([, count]) => count < 20);
  const enoughRows = underSampled.length === 0;
  if (underSampled.length) {
    console.warn(
      'CALIBRATION NOT WRITTEN: at least 20 held-out native-speaker rows are required per active label.',
    );
    for (const [label, count] of underSampled) console.warn(`- ${label}: ${count}/20 rows`);
  }
  if (rows.length && isMocked('dialect')) {
    throw new Error(
      'Dialect calibration needs real Gemini calls; set USE_MOCKS=false (or remove dialect from the mock list).',
    );
  }
  if (rows.length && !env.GEMINI_API_KEY) {
    throw new Error('Set GEMINI_API_KEY before calibrating non-empty dialect data.');
  }

  const model = env.GEMINI_AUDIO_MODEL ?? env.GEMINI_CHAT_MODEL;
  // Calibration only changes vote thresholds after inference. Cache raw votes once per ensemble
  // size instead of paying for the same Gemini calls at each minimum-vote setting.
  const promptVersion = `${dialectPromptVersion(activeLabels)}:calibration-votes-v1`;
  const cache = new DiskEvalCache(CACHE_FILE);
  const scores: CalibrationScore[] = [];
  const votesByEnsemble = new Map<number, CalibrationVotes[]>();
  for (let ensembleSize = 1; ensembleSize <= 3; ensembleSize++) {
    const votes = await mapWithConcurrency(rows, args.concurrency, async (row) => {
      const audioBytes = row.kind === 'audio' ? readAudio(row) : undefined;
      const key = evalCacheKey({
        row,
        audioBytes,
        promptVersion,
        model,
        ensembleSize,
        minimumVotes: 1,
        timeoutMs: env.DIALECT_TIMEOUT_MS,
        maxRetries: 1,
        thinkingLevel: env.GEMINI_THINKING_LEVEL,
      });
      const result = await cache.getOrRun(key, () =>
        runClassifierVotes(row, audioBytes, ensembleSize, activeLabels),
      );
      return result.value;
    });
    votesByEnsemble.set(ensembleSize, votes);

    for (let minimumVotes = 1; minimumVotes <= 3; minimumVotes++) {
      const predictions = rows.map((row, index) =>
        predictionFromVotes(row, votes[index]!, activeLabels, minimumVotes),
      );
      const metrics = computeDialectMetrics(predictions);
      scores.push({
        ensembleSize,
        minimumVotes,
        coverage: metrics.coverage,
        answeredPrecision: metrics.answeredPrecision,
        macroF1: metrics.macroF1,
      });
    }
  }

  console.log(
    '| Ensemble | Minimum votes | Coverage | Answered precision | Macro-F1 | Meets target |',
  );
  console.log('| ---: | ---: | ---: | ---: | ---: | --- |');
  for (const score of scores) {
    console.log(
      `| ${score.ensembleSize} | ${score.minimumVotes} | ${percent(score.coverage)} | ${percent(score.answeredPrecision)} | ${percent(score.macroF1)} | ${(score.answeredPrecision ?? -1) >= args.target ? 'yes' : 'no'} |`,
    );
  }
  const choice = chooseCalibration(scores, args.target);
  if (!choice) {
    console.warn(
      `No configuration reached ${percent(args.target)} answered precision; calibration.json was not written.`,
    );
  } else if (!enoughRows) {
    console.warn(
      `A configuration met ${percent(args.target)} answered precision, but calibration.json was not written because sample counts are below 20 per active label.`,
    );
  } else {
    const calibration = {
      version: 1,
      ensembleSize: choice.ensembleSize,
      minimumVotes: choice.minimumVotes,
      targetPrecision: args.target,
      rows: rows.length,
      createdAt: new Date().toISOString(),
    };
    writeFileSync(PATHS.dialectCalibration, JSON.stringify(calibration, null, 2) + '\n');
    console.log(
      `Selected ensemble=${choice.ensembleSize}, minimumVotes=${choice.minimumVotes}; wrote data/dialects/calibration.json.`,
    );
  }

  const finalEnsembleSize = choice?.ensembleSize ?? 3;
  const finalMinimumVotes = choice?.minimumVotes ?? 2;
  const finalVotes = votesByEnsemble.get(finalEnsembleSize)!;
  const finalPredictions = rows.map((row, index) =>
    predictionFromVotes(row, finalVotes[index]!, activeLabels, finalMinimumVotes),
  );
  const finalMetrics = computeDialectMetrics(finalPredictions);
  const statusLines = ['testStatus suggestions (only use --write-status to edit registry.json):'];
  for (const [label, stats] of Object.entries(finalMetrics.perClass)) {
    const qualifies = stats.support >= 20 && (stats.precision ?? -1) >= args.target;
    statusLines.push(
      `- ${label}: ${qualifies ? 'tested' : 'experimental'} (${stats.support} native row(s), precision ${percent(stats.precision)}, target ${percent(args.target)})`,
    );
  }
  console.log(statusLines.join('\n'));
  if (args.writeStatus) writeStatuses(finalMetrics.perClass, args.target);
}

interface CalibrationVotes {
  votes: string[];
  viewCount: number;
  durationMs?: number;
}

async function runClassifierVotes(
  row: DialectEvalRow,
  audioBytes: Buffer | undefined,
  ensembleSize: number,
  activeLabels: string[],
): Promise<CalibrationVotes> {
  let votes: string[] = [];
  await classifyDialect({
    ...(audioBytes && {
      audio: { data: audioBytes.toString('base64'), mimeType: mimeType(row.audioFile!) },
    }),
    ...(row.text && { text: row.text }),
    activeLabels,
    ensembleSize,
    minimumVotes: 1,
    maxRetries: 1,
    onDecision: (value) => (votes = value.votes),
  });
  const availableViews = row.kind === 'audio' && row.text ? 3 : 1;
  return {
    votes,
    viewCount: Math.min(ensembleSize, availableViews),
    durationMs: row.durationMs ?? (audioBytes ? wavDurationMs(audioBytes) : undefined),
  };
}

function predictionFromVotes(
  row: DialectEvalRow,
  result: CalibrationVotes,
  activeLabels: string[],
  minimumVotes: number,
): DialectPrediction {
  const predictedLabel = selectedClassifierLabel(result.votes, activeLabels, minimumVotes);
  const matchingVotes = predictedLabel
    ? result.votes.filter((vote) => vote === predictedLabel).length
    : 0;
  return {
    id: row.id,
    goldLabel: row.label,
    predictedLabel,
    highConfidence: predictedLabel !== null && matchingVotes === result.viewCount,
    script: row.script,
    wordCount: row.text ? row.text.trim().split(/\s+/u).filter(Boolean).length : undefined,
    kind: row.kind,
    codeSwitch: row.codeSwitch,
    durationMs: result.durationMs,
  };
}

function readAudio(row: DialectEvalRow): Buffer {
  return readFileSync(safeAudioPath(PATHS.dialectAudio, row.audioFile!));
}

function mimeType(audioFile: string): string {
  const byExtension: Record<string, string> = {
    '.wav': 'audio/wav',
    '.webm': 'audio/webm',
    '.mp3': 'audio/mp3',
    '.m4a': 'audio/mp4',
    '.mp4': 'audio/mp4',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
  };
  const result = byExtension[path.extname(audioFile).toLowerCase()];
  if (!result) throw new Error(`Unsupported audio extension: ${audioFile}`);
  return result;
}

function wavDurationMs(data: Buffer): number | undefined {
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE')
    return undefined;
  let rate: number | undefined,
    channels: number | undefined,
    bits: number | undefined,
    bytes: number | undefined;
  for (let offset = 12; offset + 8 <= data.length;) {
    const id = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ' && size >= 16 && start + 16 <= data.length) {
      channels = data.readUInt16LE(start + 2);
      rate = data.readUInt32LE(start + 4);
      bits = data.readUInt16LE(start + 14);
    } else if (id === 'data') bytes = Math.min(size, data.length - start);
    if (size > data.length || start + size <= offset) break;
    offset = start + size + (size % 2);
  }
  const bytesPerSecond = rate && channels && bits ? (rate * channels * bits) / 8 : undefined;
  return bytesPerSecond && bytes !== undefined
    ? Math.round((bytes / bytesPerSecond) * 1000)
    : undefined;
}

function writeStatuses(
  perClass: Record<string, { support: number; precision: number | null }>,
  target: number,
): void {
  const registry = JSON.parse(readFileSync(REGISTRY_FILE, 'utf8')) as Array<{
    id: string;
    testStatus: string;
  }>;
  for (const entry of registry) {
    const stats = perClass[entry.id];
    if (!stats) continue;
    entry.testStatus =
      stats.support >= 20 && (stats.precision ?? -1) >= target ? 'tested' : 'experimental';
  }
  writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2) + '\n');
}

function parseArgs(argv: string[]): {
  target: number;
  concurrency: number;
  testset?: string;
  writeStatus: boolean;
} {
  const result = {
    target: 0.9,
    concurrency: 4,
    testset: undefined as string | undefined,
    writeStatus: argv.includes('--write-status'),
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!;
    if (arg === '--target') result.target = Number(argv[++index]);
    else if (arg.startsWith('--target=')) result.target = Number(arg.slice(9));
    else if (arg === '--concurrency') result.concurrency = Number(argv[++index]);
    else if (arg.startsWith('--concurrency=')) result.concurrency = Number(arg.split('=')[1]);
    else if (arg === '--testset') result.testset = argv[++index];
    else if (arg.startsWith('--testset=')) result.testset = arg.slice(10);
  }
  if (!Number.isFinite(result.target) || result.target < 0 || result.target > 1)
    throw new Error('--target must be between 0 and 1');
  if (!Number.isInteger(result.concurrency) || result.concurrency < 1)
    throw new Error('--concurrency must be >= 1');
  return result;
}

function percent(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
