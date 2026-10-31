import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PATHS } from '../server/src/config/env.js';
import {
  assignSpeakerSplits,
  parseContributions,
  type DialectContribution,
  type SplitSide,
} from '../server/src/modules/dialect/contributions.js';
import {
  dialectExemplarSchema,
  loadDialectExemplars,
} from '../server/src/modules/dialect/exemplars.js';
import {
  parseDialectEvalRows,
  type DialectEvalRow,
} from '../server/src/modules/dialect/evaluation.js';

interface ExistingSpeakerState {
  assignments: Map<string, SplitSide>;
  byLabel: Map<string, Map<string, SplitSide>>;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.files.length === 0)
    throw new Error('Usage: npm run merge:contrib -- a.json b.json [--licence value]');
  const contributions: DialectContribution[] = [];
  for (const file of args.files) {
    contributions.push(...parseContributions(JSON.parse(readFileSync(file, 'utf8')), file));
  }
  ensureUniqueContributionIds(contributions);

  const examples = loadDialectExemplars();
  const testRows = parseDialectEvalRows(readFileSync(PATHS.dialectTestset, 'utf8'));
  const existing = existingSpeakerState(examples, testRows);
  const assignments = assignSpeakerSplits(contributions, existing.assignments, existing.byLabel);
  const additionsByLabel = new Map<
    string,
    { exemplars: number; testset: number; skipped: number }
  >();
  const exemplarAdds = new Map<string, ReturnType<typeof dialectExemplarSchema.parse>[]>();
  const newTestRows: DialectEvalRow[] = [];
  const testIds = new Set(testRows.map(({ id }) => id));
  const existingExampleKeys = new Set(
    [...examples].flatMap(([label, rows]) =>
      rows.map((row) => exampleKey(label, row.speakerAnonId, row.text)),
    ),
  );
  const audioWrites: Array<{ path: string; bytes: Buffer }> = [];

  for (const contribution of contributions) {
    const stats = additionsByLabel.get(contribution.label) ?? {
      exemplars: 0,
      testset: 0,
      skipped: 0,
    };
    additionsByLabel.set(contribution.label, stats);
    const side = assignments.get(contribution.speakerAnonId)!;
    let audioFile: string | undefined;
    if (contribution.audioBase64 && contribution.audioMime) {
      const bytes = Buffer.from(contribution.audioBase64, 'base64');
      const extension = audioExtension(contribution.audioMime);
      const name = createHash('sha256')
        .update(contribution.id)
        .update(bytes)
        .digest('hex')
        .slice(0, 32);
      audioFile = `audio/${name}.${extension}`;
      audioWrites.push({ path: path.join(PATHS.dialectAudio, `${name}.${extension}`), bytes });
    }

    if (side === 'exemplars') {
      const key = exampleKey(
        contribution.label,
        contribution.speakerAnonId,
        contribution.transcript,
      );
      if (existingExampleKeys.has(key)) {
        stats.skipped++;
        continue;
      }
      const row = dialectExemplarSchema.parse({
        text: contribution.transcript,
        hindiMeaning: contribution.hindiMeaning,
        script: contribution.script,
        speakerAnonId: contribution.speakerAnonId,
        consent: true,
      });
      const list = exemplarAdds.get(contribution.label) ?? [];
      list.push(row);
      exemplarAdds.set(contribution.label, list);
      existingExampleKeys.add(key);
      stats.exemplars++;
      continue;
    }

    if (testIds.has(contribution.id)) {
      stats.skipped++;
      continue;
    }
    const row: DialectEvalRow = {
      id: contribution.id,
      kind: audioFile ? 'audio' : 'text',
      ...(audioFile && { audioFile }),
      text: contribution.transcript,
      script: contribution.script,
      label: contribution.label,
      district: contribution.district,
      ...(contribution.area && { area: contribution.area }),
      speakerAnonId: contribution.speakerAnonId,
      consent: true,
      codeSwitch: contribution.codeSwitch,
      hindiMeaning: contribution.hindiMeaning,
      annotatorConfidence: 'unrated',
      licence: args.licence,
      durationMs: contribution.durationMs,
    };
    newTestRows.push(row);
    testIds.add(contribution.id);
    stats.testset++;
  }

  // All input and consent checks finish before any writes. Save audio before metadata can reference it.
  mkdirSync(PATHS.dialectAudio, { recursive: true });
  for (const audio of audioWrites) {
    if (!existsSync(audio.path)) writeFileSync(audio.path, audio.bytes, { flag: 'wx' });
  }
  for (const [label, additions] of exemplarAdds) {
    const file = path.join(PATHS.dialectExemplars, `${label}.jsonl`);
    const existingText = readFileSync(file, 'utf8');
    const additionText = additions.map((row) => JSON.stringify(row)).join('\n') + '\n';
    writeFileSync(file, appendJsonl(existingText, additionText));
  }
  writeFileSync(
    PATHS.dialectTestset,
    appendJsonl(
      readFileSync(PATHS.dialectTestset, 'utf8'),
      newTestRows.map((row) => JSON.stringify(row)).join('\n') + (newTestRows.length ? '\n' : ''),
    ),
  );

  console.log(`Merged ${contributions.length} consented contribution(s).`);
  console.log(
    '| Label | Exemplars total | Test rows total | Added exemplars | Added test rows | Skipped |',
  );
  console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
  const labels = new Set([
    ...examples.keys(),
    ...testRows.map(({ label }) => label),
    ...additionsByLabel.keys(),
  ]);
  for (const label of [...labels].sort()) {
    const count = additionsByLabel.get(label) ?? { exemplars: 0, testset: 0, skipped: 0 };
    const existingExemplars = examples.get(label)?.length ?? 0;
    const existingTestRows = testRows.filter((row) => row.label === label).length;
    console.log(
      `| ${label} | ${existingExemplars + count.exemplars} | ${existingTestRows + count.testset} | ${count.exemplars} | ${count.testset} | ${count.skipped} |`,
    );
  }
}

function existingSpeakerState(
  exemplars: ReadonlyMap<string, readonly { speakerAnonId: string }[]>,
  testRows: readonly DialectEvalRow[],
): ExistingSpeakerState {
  const assignments = new Map<string, SplitSide>();
  const byLabel = new Map<string, Map<string, SplitSide>>();
  const add = (label: string, speaker: string, side: SplitSide) => {
    const previous = assignments.get(speaker);
    if (previous && previous !== side)
      throw new Error(`Existing speaker ${speaker} already occurs in both splits`);
    assignments.set(speaker, side);
    const speakers = byLabel.get(label) ?? new Map<string, SplitSide>();
    speakers.set(speaker, side);
    byLabel.set(label, speakers);
  };
  for (const [label, rows] of exemplars)
    for (const row of rows) add(label, row.speakerAnonId, 'exemplars');
  for (const row of testRows) add(row.label, row.speakerAnonId, 'testset');
  return { assignments, byLabel };
}

function ensureUniqueContributionIds(rows: readonly DialectContribution[]): void {
  const ids = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.id))
      throw new Error(
        `Duplicate contribution id "${row.id}" across input files; no data was merged`,
      );
    ids.add(row.id);
  }
}

function exampleKey(label: string, speaker: string, text: string): string {
  return `${label}\u0000${speaker}\u0000${text}`;
}

function appendJsonl(existing: string, addition: string): string {
  if (!addition) return existing;
  return (existing && !existing.endsWith('\n') ? existing + '\n' : existing) + addition;
}

function audioExtension(mime: string): string {
  const normalized = mime.split(';')[0]!.toLowerCase();
  const extensions: Record<string, string> = {
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/m4a': 'm4a',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
  };
  const extension = extensions[normalized];
  if (!extension) throw new Error(`Unsupported contribution audio type: ${mime}`);
  return extension;
}

function parseArgs(argv: string[]): { files: string[]; licence: string } {
  const files: string[] = [];
  let licence = 'not-specified';
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index]!;
    if (value === '--licence') licence = argv[++index] ?? '';
    else if (value.startsWith('--licence=')) licence = value.slice('--licence='.length);
    else if (!value.startsWith('--')) files.push(path.resolve(value));
  }
  if (!licence.trim()) throw new Error('--licence cannot be empty');
  return { files, licence };
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
