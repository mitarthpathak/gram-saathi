import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { getDialectRegistry, STANDARD_DIALECT_LABELS } from './registry';

export const dialectEvalRowSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['audio', 'text']),
    audioFile: z.string().min(1).optional(),
    text: z.string().min(1).optional(),
    script: z.enum(['devanagari', 'roman', 'mixed', 'other']),
    label: z.string().min(1),
    district: z.string().min(1),
    area: z.string().optional(),
    speakerAnonId: z.string().min(1),
    consent: z.literal(true),
    codeSwitch: z.boolean(),
    hindiMeaning: z.string().min(1),
    annotatorConfidence: z.enum(['low', 'medium', 'high', 'unrated']),
    licence: z.string().min(1),
    durationMs: z.number().nonnegative().optional(),
  })
  .superRefine((row, ctx) => {
    if (row.kind === 'audio' && !row.audioFile) {
      ctx.addIssue({ code: 'custom', path: ['audioFile'], message: 'Required for audio rows' });
    }
    if (row.kind === 'text' && !row.text) {
      ctx.addIssue({ code: 'custom', path: ['text'], message: 'Required for text rows' });
    }
  });

export type DialectEvalRow = z.infer<typeof dialectEvalRowSchema>;

export interface DialectPrediction {
  id: string;
  goldLabel: string;
  predictedLabel: string | null;
  highConfidence: boolean;
  script: string;
  wordCount?: number;
  kind: 'audio' | 'text';
  codeSwitch: boolean;
  durationMs?: number;
}

export interface ClassMetrics {
  support: number;
  predicted: number;
  precision: number | null;
  recall: number;
  f1: number;
}

export interface DialectEvaluationMetrics {
  rows: number;
  perClass: Record<string, ClassMetrics>;
  macroF1: number;
  confusionMatrix: Record<string, Record<string, number>>;
  abstentionRate: number;
  answeredPrecision: number | null;
  coverage: number;
  wrongWithHighConfidence: DialectPrediction[];
  breakdowns: Record<string, Record<string, BreakdownMetrics>>;
  confusablePairs: Record<string, { rows: number; accuracy: number | null }>;
}

export interface BreakdownMetrics {
  rows: number;
  answered: number;
  coverage: number;
  answeredPrecision: number | null;
  abstentionRate: number;
}

const ALL_LABELS = new Set([
  ...getDialectRegistry().map(({ id }) => id),
  ...STANDARD_DIALECT_LABELS,
]);

export function parseDialectEvalRows(text: string, fileName = 'testset.jsonl'): DialectEvalRow[] {
  const rows: DialectEvalRow[] = [];
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line) continue;
    try {
      const row = dialectEvalRowSchema.parse(JSON.parse(line));
      if (!ALL_LABELS.has(row.label)) throw new Error(`Unknown label "${row.label}"`);
      rows.push(row);
    } catch (error) {
      throw new Error(`${fileName}:${index + 1}: ${errorMessage(error)}`, { cause: error });
    }
  }
  const ids = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.id)) throw new Error(`${fileName}: duplicate row id "${row.id}"`);
    ids.add(row.id);
  }
  return rows;
}

export function assertSpeakerDisjoint(
  rows: readonly Pick<DialectEvalRow, 'speakerAnonId'>[],
  exemplars: ReadonlyMap<string, readonly { speakerAnonId: string }[]>,
): void {
  const exemplarSpeakers = new Set([...exemplars.values()].flat().map((row) => row.speakerAnonId));
  const overlap = [...new Set(rows.map((row) => row.speakerAnonId))]
    .filter((speaker) => exemplarSpeakers.has(speaker))
    .sort();
  if (overlap.length) {
    throw new Error(
      `Speaker-disjoint evaluation failed; speakers occur in both splits: ${overlap.join(', ')}`,
    );
  }
}

export function computeDialectMetrics(
  predictions: readonly DialectPrediction[],
  confusablePairs: readonly [string, string][] = registryConfusablePairs(),
): DialectEvaluationMetrics {
  const labels = [
    ...new Set(predictions.flatMap((row) => [row.goldLabel, row.predictedLabel ?? '<abstain>'])),
  ].sort();
  const goldLabels = [...new Set(predictions.map((row) => row.goldLabel))].sort();
  const confusionMatrix: Record<string, Record<string, number>> = {};
  for (const gold of goldLabels) {
    confusionMatrix[gold] = Object.fromEntries(labels.map((label) => [label, 0]));
  }
  for (const row of predictions) {
    const predicted = row.predictedLabel ?? '<abstain>';
    confusionMatrix[row.goldLabel]![predicted] =
      (confusionMatrix[row.goldLabel]![predicted] ?? 0) + 1;
  }

  const perClass: Record<string, ClassMetrics> = {};
  for (const label of labels.filter((value) => value !== '<abstain>')) {
    const support = predictions.filter((row) => row.goldLabel === label).length;
    const predicted = predictions.filter((row) => row.predictedLabel === label).length;
    const truePositive = predictions.filter(
      (row) => row.goldLabel === label && row.predictedLabel === label,
    ).length;
    const precision = predicted ? truePositive / predicted : null;
    const recall = support ? truePositive / support : 0;
    const f1 =
      precision === null || precision + recall === 0
        ? 0
        : (2 * precision * recall) / (precision + recall);
    perClass[label] = { support, predicted, precision, recall, f1 };
  }
  const answered = predictions.filter((row) => row.predictedLabel !== null);
  const correct = answered.filter((row) => row.predictedLabel === row.goldLabel).length;
  const macroF1 = goldLabels.length
    ? goldLabels.reduce((sum, label) => sum + perClass[label]!.f1, 0) / goldLabels.length
    : 0;

  const breakdowns: DialectEvaluationMetrics['breakdowns'] = {
    script: {},
    shortText: {},
    codeSwitch: {},
    audioDuration: {},
  };
  for (const row of predictions) {
    addBreakdown(breakdowns.script, row.script, row);
    const shortTextGroup =
      row.wordCount === undefined ? 'no transcript' : row.wordCount < 5 ? '<5 words' : '5+ words';
    addBreakdown(breakdowns.shortText, shortTextGroup, row);
    addBreakdown(breakdowns.codeSwitch, row.codeSwitch ? 'code-switch' : 'single-language', row);
    addBreakdown(breakdowns.audioDuration, durationBucket(row), row);
  }

  const pairMetrics: DialectEvaluationMetrics['confusablePairs'] = {};
  for (const [left, right] of confusablePairs) {
    const members = predictions.filter((row) => row.goldLabel === left || row.goldLabel === right);
    if (!members.length) continue;
    const hits = members.filter((row) => row.predictedLabel === row.goldLabel).length;
    pairMetrics[`${left} vs ${right}`] = { rows: members.length, accuracy: hits / members.length };
  }

  return {
    rows: predictions.length,
    perClass,
    macroF1,
    confusionMatrix,
    abstentionRate: predictions.length
      ? (predictions.length - answered.length) / predictions.length
      : 0,
    answeredPrecision: answered.length ? correct / answered.length : null,
    coverage: predictions.length ? answered.length / predictions.length : 0,
    wrongWithHighConfidence: predictions.filter(
      (row) => row.highConfidence && row.predictedLabel !== row.goldLabel,
    ),
    breakdowns,
    confusablePairs: pairMetrics,
  };
}

function addBreakdown(
  groups: Record<string, BreakdownMetrics>,
  key: string,
  row: DialectPrediction,
): void {
  const group = (groups[key] ??= {
    rows: 0,
    answered: 0,
    coverage: 0,
    answeredPrecision: null,
    abstentionRate: 0,
  });
  group.rows++;
  if (row.predictedLabel !== null) {
    group.answered++;
    if (row.predictedLabel === row.goldLabel) {
      group.answeredPrecision =
        ((group.answeredPrecision ?? 0) * (group.answered - 1) + 1) / group.answered;
    } else {
      group.answeredPrecision =
        ((group.answeredPrecision ?? 0) * (group.answered - 1)) / group.answered;
    }
  }
  group.coverage = group.answered / group.rows;
  group.abstentionRate = 1 - group.coverage;
}

function durationBucket(row: DialectPrediction): string {
  if (row.kind !== 'audio') return 'not-applicable';
  if (row.durationMs === undefined) return 'unknown';
  if (row.durationMs < 5000) return '<5s';
  if (row.durationMs <= 15_000) return '5-15s';
  return '>15s';
}

export function registryConfusablePairs(): [string, string][] {
  const pairs = new Map<string, [string, string]>();
  for (const entry of getDialectRegistry()) {
    for (const other of entry.confusableWith) {
      const pair: [string, string] = [entry.id, other].sort() as [string, string];
      pairs.set(pair.join('|'), pair);
    }
  }
  return [...pairs.values()].sort((a, b) => a.join('|').localeCompare(b.join('|')));
}

export function rowHash(row: DialectEvalRow, audioBytes?: Buffer): string {
  return createHash('sha256')
    .update(stableStringify(row))
    .update(audioBytes ?? Buffer.alloc(0))
    .digest('hex');
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value !== 'object' || value === null) return JSON.stringify(value) ?? 'null';
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

export function evalCacheKey(input: {
  row: DialectEvalRow;
  audioBytes?: Buffer;
  promptVersion: string;
  model: string;
  ensembleSize: number;
  minimumVotes: number;
  timeoutMs: number;
  maxRetries: number;
  thinkingLevel: string;
}): string {
  return createHash('sha256')
    .update(
      [
        rowHash(input.row, input.audioBytes),
        input.promptVersion,
        input.model,
        input.ensembleSize,
        input.minimumVotes,
        input.timeoutMs,
        input.maxRetries,
        input.thinkingLevel,
      ].join('\n'),
    )
    .digest('hex');
}

/** Small JSON disk cache with in-process deduplication and atomic writes. */
export class DiskEvalCache {
  private readonly entries = new Map<string, unknown>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    if (!existsSync(filePath)) return;
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) this.entries.set(key, value);
    } catch {
      // A corrupt cache is disposable; recompute rows and replace it on the next write.
    }
  }

  async getOrRun<T>(key: string, run: () => Promise<T>): Promise<{ value: T; hit: boolean }> {
    if (this.entries.has(key)) return { value: this.entries.get(key) as T, hit: true };
    const existing = this.inFlight.get(key);
    if (existing) return { value: (await existing) as T, hit: true };
    const pending = run();
    this.inFlight.set(key, pending);
    try {
      const value = await pending;
      this.entries.set(key, value);
      this.write();
      return { value, hit: false };
    } finally {
      this.inFlight.delete(key);
    }
  }

  private write(): void {
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(Object.fromEntries(this.entries), null, 2) + '\n');
    renameSync(temporary, this.filePath);
  }
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Concurrency limit must be >= 1');
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await mapper(items[index]!, index);
      }
    }),
  );
  return results;
}

export function safeAudioPath(audioRoot: string, audioFile: string): string {
  const normalized = audioFile.replace(/^audio[\\/]/, '');
  const resolvedRoot = path.resolve(audioRoot);
  const resolved = path.resolve(resolvedRoot, normalized);
  if (!resolved.startsWith(resolvedRoot + path.sep))
    throw new Error('audioFile must stay under data/eval/dialect/audio');
  return resolved;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
