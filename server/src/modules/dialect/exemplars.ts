import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { env, PATHS } from '../../config/env';
import { logger } from '../../lib/logger';
import { getDialectRegistry, STANDARD_DIALECT_LABELS } from './registry';

export const dialectExemplarSchema = z.object({
  text: z.string().min(1),
  hindiMeaning: z.string().min(1),
  script: z.enum(['devanagari', 'roman', 'mixed', 'other']),
  speakerAnonId: z.string().min(1),
  consent: z.literal(true),
  notes: z.string().optional(),
});

export type DialectExemplar = z.infer<typeof dialectExemplarSchema>;
export type DialectExemplarSet = ReadonlyMap<string, readonly DialectExemplar[]>;

let cached: DialectExemplarSet | undefined;

/** Parses JSONL without accepting comments or fabricated placeholders as data rows. */
export function loadDialectExemplars(
  directory: string = PATHS.dialectExemplars,
): Map<string, DialectExemplar[]> {
  const labels = [...getDialectRegistry().map(({ id }) => id), ...STANDARD_DIALECT_LABELS];
  const allowed = new Set(labels);
  const files = existsSync(directory)
    ? readdirSync(directory).filter((file) => file.endsWith('.jsonl'))
    : [];
  const unknown = files
    .map((file) => path.basename(file, '.jsonl'))
    .filter((id) => !allowed.has(id));
  if (unknown.length) throw new Error(`Unknown dialect exemplar file(s): ${unknown.join(', ')}`);

  const result = new Map<string, DialectExemplar[]>();
  for (const label of labels) {
    const file = path.join(directory, `${label}.jsonl`);
    const rows: DialectExemplar[] = [];
    if (existsSync(file)) {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index].trim();
        if (!line) continue;
        try {
          rows.push(dialectExemplarSchema.parse(JSON.parse(line)));
        } catch (error) {
          throw new Error(`Invalid exemplar ${file}:${index + 1}: ${errorMessage(error)}`, {
            cause: error,
          });
        }
      }
    }
    result.set(label, rows);
  }
  return result;
}

export function getDialectExemplars(): DialectExemplarSet {
  cached ??= loadDialectExemplars();
  return cached;
}

/** Log missing real examples once during startup. Empty files are expected before field collection. */
export function logDialectExemplarCoverage(): void {
  const rows = getDialectExemplars();
  const labels = [...rows].filter(([, examples]) => examples.length === 0).map(([id]) => id);
  if (labels.length) logger.info(`dialect labels with no exemplars: ${labels.join(', ')}`);
}

export interface PromptExemplarOptions {
  perLabel?: number;
  tokenBudget?: number;
}

/** Stable prompt rendering: pairwise hard negatives first, then remaining rows round-robin. */
export function renderPromptExemplars(
  activeLabels: string[],
  exemplars: DialectExemplarSet = getDialectExemplars(),
  options: PromptExemplarOptions = {},
): string[] {
  const perLabel = options.perLabel ?? env.DIALECT_EXEMPLARS_PER_LABEL;
  const tokenBudget = options.tokenBudget ?? env.DIALECT_EXEMPLAR_TOKEN_BUDGET;
  if (perLabel <= 0 || tokenBudget <= 0) return [];

  const active = new Set(activeLabels);
  const registry = getDialectRegistry();
  const allowedLabels = new Set([...registry.map(({ id }) => id), ...STANDARD_DIALECT_LABELS]);
  const selected = new Map<string, DialectExemplar[]>();
  for (const label of activeLabels) {
    if (!allowedLabels.has(label)) continue;
    const candidates = [...(exemplars.get(label) ?? [])].sort(compareExemplars);
    selected.set(label, candidates.slice(0, perLabel));
  }

  const output: string[] = [];
  let usedTokens = 0;
  const usedByLabel = new Map<string, number>();
  const paired = new Set<string>();
  for (const entry of registry) {
    if (!active.has(entry.id)) continue;
    for (const otherId of entry.confusableWith) {
      if (!active.has(otherId) || !allowedLabels.has(otherId) || entry.id === otherId) continue;
      const key = [entry.id, otherId].sort().join('|');
      if (paired.has(key)) continue;
      paired.add(key);
      const left = nextExample(entry.id, selected, usedByLabel);
      const right = nextExample(otherId, selected, usedByLabel);
      if (!left || !right) {
        if (left) decrement(usedByLabel, entry.id);
        if (right) decrement(usedByLabel, otherId);
        continue;
      }
      const block = [
        `Confusable pair ${entry.id} / ${otherId} (compare positive evidence):`,
        formatExample(entry.id, left),
        formatExample(otherId, right),
      ];
      const cost = estimatePromptTokenUnits(block.join('\n'));
      if (usedTokens + cost > tokenBudget) {
        // Keep this pair out of standalone rendering too; never separate a hard-negative pair.
        continue;
      }
      usedTokens += cost;
      output.push(...block);
    }
  }

  // Continue round-robin so one well-sampled label cannot consume the entire remaining budget.
  let added = true;
  let round = 0;
  while (added) {
    added = false;
    for (const label of activeLabels) {
      const example = selected.get(label)?.[round];
      if (!example || (usedByLabel.get(label) ?? 0) > round) continue;
      const block = formatExample(label, example);
      const cost = estimatePromptTokenUnits(block);
      if (usedTokens + cost > tokenBudget) continue;
      usedTokens += cost;
      usedByLabel.set(label, round + 1);
      output.push(block);
      added = true;
    }
    round++;
  }
  return output;
}

function nextExample(
  label: string,
  selected: Map<string, DialectExemplar[]>,
  used: Map<string, number>,
): DialectExemplar | undefined {
  const index = used.get(label) ?? 0;
  const example = selected.get(label)?.[index];
  if (example) used.set(label, index + 1);
  return example;
}

function decrement(map: Map<string, number>, label: string): void {
  const count = map.get(label) ?? 0;
  if (count <= 1) map.delete(label);
  else map.set(label, count - 1);
}

function formatExample(label: string, row: DialectExemplar): string {
  return `- ${label} [${row.script}]: “${row.text}” → Hindi meaning: “${row.hindiMeaning}”`;
}

/** UTF-8 byte count is a conservative upper bound for tokenizer output on valid text. */
export function estimatePromptTokenUnits(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function compareExemplars(a: DialectExemplar, b: DialectExemplar): number {
  const key = (row: DialectExemplar) =>
    createHash('sha256').update(JSON.stringify(row)).digest('hex');
  return key(a).localeCompare(key(b));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function resetDialectExemplarCache(): void {
  cached = undefined;
}
