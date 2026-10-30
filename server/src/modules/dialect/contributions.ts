import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getDialectRegistry, STANDARD_DIALECT_LABELS } from './registry';

const contributionSchema = z
  .object({
    id: z.string().min(1).max(256),
    label: z.string().min(1),
    transcript: z.string().min(1),
    hindiMeaning: z.string().min(1),
    script: z.enum(['devanagari', 'roman', 'mixed', 'other']),
    district: z.string().min(1),
    area: z.string().optional(),
    speakerAnonId: z.string().min(1),
    consent: z.literal(true),
    codeSwitch: z.boolean(),
    durationMs: z.number().nonnegative(),
    audioBase64: z.string().optional(),
    audioMime: z.string().optional(),
  })
  .superRefine((row, ctx) => {
    if (Boolean(row.audioBase64) !== Boolean(row.audioMime)) {
      ctx.addIssue({
        code: 'custom',
        path: ['audioBase64'],
        message: 'audioBase64 and audioMime must be supplied together',
      });
    }
    if (row.audioMime && !row.audioMime.toLowerCase().startsWith('audio/')) {
      ctx.addIssue({ code: 'custom', path: ['audioMime'], message: 'audioMime must be audio/*' });
    }
    if (row.audioBase64 && row.audioBase64.length > 14_000_000) {
      ctx.addIssue({ code: 'custom', path: ['audioBase64'], message: 'Audio exceeds 10 MB' });
    }
  });

export type DialectContribution = z.infer<typeof contributionSchema>;
export type SplitSide = 'exemplars' | 'testset';

const validLabels = new Set([
  ...getDialectRegistry().map(({ id }) => id),
  ...STANDARD_DIALECT_LABELS,
]);

/** Validates consent before any files or audio are written. */
export function parseContributions(value: unknown, source = 'contribution'): DialectContribution[] {
  if (!Array.isArray(value)) throw new Error(`${source} must be a JSON array`);
  const parsed: DialectContribution[] = [];
  const seenIds = new Set<string>();
  for (const [index, item] of value.entries()) {
    const rowId =
      typeof item === 'object' && item !== null && 'id' in item ? String(item.id) : `${index + 1}`;
    if (
      typeof item !== 'object' ||
      item === null ||
      !('consent' in item) ||
      item.consent !== true
    ) {
      throw new Error(`${source} row ${rowId}: consent must be true; no data was merged`);
    }
    const row = contributionSchema.parse(item);
    if (!validLabels.has(row.label))
      throw new Error(`${source} row ${rowId}: unknown label "${row.label}"`);
    if (seenIds.has(row.id)) throw new Error(`${source}: duplicate contribution id "${row.id}"`);
    seenIds.add(row.id);
    if (row.audioBase64) {
      const compact = row.audioBase64.replace(/\s/g, '');
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact))
        throw new Error(`${source} row ${rowId}: audioBase64 is invalid`);
      const bytes = Buffer.from(compact, 'base64');
      if (
        bytes.length > 10 * 1024 * 1024 ||
        bytes.toString('base64').replace(/=+$/, '') !== compact.replace(/=+$/, '')
      ) {
        throw new Error(`${source} row ${rowId}: audioBase64 is invalid or exceeds 10 MB`);
      }
    }
    parsed.push({ ...row, audioBase64: row.audioBase64?.replace(/\s/g, '') });
  }
  return parsed;
}

/** Hash split, then deterministic local improvements to give each supported label both sides. */
export function assignSpeakerSplits(
  rows: readonly Pick<DialectContribution, 'speakerAnonId' | 'label'>[],
  fixedAssignments: ReadonlyMap<string, SplitSide> = new Map(),
  existingLabelSpeakers: ReadonlyMap<string, ReadonlyMap<string, SplitSide>> = new Map(),
): Map<string, SplitSide> {
  const labelsBySpeaker = new Map<string, Set<string>>();
  for (const row of rows) {
    const labels = labelsBySpeaker.get(row.speakerAnonId) ?? new Set<string>();
    labels.add(row.label);
    labelsBySpeaker.set(row.speakerAnonId, labels);
  }

  const assignments = new Map<string, SplitSide>();
  for (const speaker of [...labelsBySpeaker.keys()].sort()) {
    assignments.set(speaker, fixedAssignments.get(speaker) ?? baseSplit(speaker));
  }

  const labels = new Set<string>([
    ...[...labelsBySpeaker.values()].flatMap((items) => [...items]),
    ...existingLabelSpeakers.keys(),
  ]);
  const speakers = [...assignments.keys()]
    .filter((speaker) => !fixedAssignments.has(speaker))
    .sort(compareSpeakerHash);
  for (let pass = 0; pass < speakers.length * Math.max(1, labels.size); pass++) {
    const current = splitDeficit(labels, assignments, labelsBySpeaker, existingLabelSpeakers);
    let candidate: { speaker: string; score: number } | undefined;
    for (const speaker of speakers) {
      assignments.set(speaker, opposite(assignments.get(speaker)!));
      const score = splitDeficit(labels, assignments, labelsBySpeaker, existingLabelSpeakers);
      assignments.set(speaker, opposite(assignments.get(speaker)!));
      if (
        score < current &&
        (!candidate ||
          score < candidate.score ||
          (score === candidate.score && compareSpeakerHash(speaker, candidate.speaker) < 0))
      ) {
        candidate = { speaker, score };
      }
    }
    if (!candidate) break;
    assignments.set(candidate.speaker, opposite(assignments.get(candidate.speaker)!));
  }
  return assignments;
}

function splitDeficit(
  labels: Set<string>,
  assignments: ReadonlyMap<string, SplitSide>,
  labelsBySpeaker: ReadonlyMap<string, Set<string>>,
  existing: ReadonlyMap<string, ReadonlyMap<string, SplitSide>>,
): number {
  let deficit = 0;
  for (const label of labels) {
    const sides = new Set<SplitSide>();
    const speakers = new Set<string>();
    for (const [speaker, side] of existing.get(label) ?? []) {
      speakers.add(speaker);
      sides.add(side);
    }
    for (const [speaker, speakerLabels] of labelsBySpeaker) {
      if (!speakerLabels.has(label)) continue;
      speakers.add(speaker);
      sides.add(assignments.get(speaker)!);
    }
    if (speakers.size >= 2 && sides.size < 2) deficit++;
  }
  return deficit;
}

function baseSplit(speaker: string): SplitSide {
  const first = createHash('sha256').update(speaker).digest().readUInt32BE(0);
  return first % 3 === 0 ? 'exemplars' : 'testset';
}

function compareSpeakerHash(a: string, b: string): number {
  return createHash('sha256')
    .update(a)
    .digest('hex')
    .localeCompare(createHash('sha256').update(b).digest('hex'));
}

function opposite(side: SplitSide): SplitSide {
  return side === 'exemplars' ? 'testset' : 'exemplars';
}
