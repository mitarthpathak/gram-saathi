/** Builds the readiness matrix and renders docs/PIPELINE_AUDIT.md from the audit results. */
import type { DialectRegistryEntry } from '../../src/modules/dialect/registry';
import { aggregateStatus } from './checks';
import { TTS_DOCS, TTS_NAMED_LANGUAGES } from './ttsLanguages';
import {
  MATRIX_COLUMNS,
  MATRIX_COLUMN_TITLES,
  type AuditResults,
  type Check,
  type MatrixCell,
  type MatrixColumn,
  type MatrixRow,
  type RegionalObservation,
  type StageResult,
  type Status,
} from './types';

const LANGUAGE_ROWS: [string, string][] = [
  ['hi', 'Hindi'],
  ['mr', 'Marathi'],
  ['ta', 'Tamil'],
  ['en', 'English'],
];

/** Merges checks of the same stage produced by several workers. */
export function mergeStages(stages: StageResult[]): StageResult[] {
  const byId = new Map<string, StageResult>();
  for (const stage of stages) {
    const existing = byId.get(stage.stage);
    if (!existing) {
      byId.set(stage.stage, { ...stage, checks: [...stage.checks] });
      continue;
    }
    existing.checks.push(...stage.checks);
    existing.durationMs += stage.durationMs;
    existing.reason = [existing.reason, stage.reason].filter(Boolean).join(' / ') || undefined;
    if (existing.mode !== stage.mode)
      existing.mode = existing.checks.length ? existing.mode : stage.mode;
    existing.data = { ...existing.data, ...stage.data };
    const statuses = [...existing.checks.map((check) => check.status)];
    if (statuses.length === 0) statuses.push(existing.status, stage.status);
    existing.status = aggregateStatus(statuses);
  }
  return [...byId.values()].sort((a, b) => a.stage.localeCompare(b.stage));
}

export function buildMatrix(
  observations: RegionalObservation[],
  registry: DialectRegistryEntry[],
): MatrixRow[] {
  const rows: [string, string][] = [
    ...LANGUAGE_ROWS,
    ...registry.map((entry): [string, string] => [entry.id, `${entry.name} (${entry.nativeName})`]),
  ];
  const isLanguage = (row: string) => LANGUAGE_ROWS.some(([code]) => code === row);
  return rows.map(([row, label]) => {
    const cell = (column: MatrixColumn): MatrixCell => {
      if (column === 'ttsNamesLanguage') {
        const named = TTS_NAMED_LANGUAGES[row];
        return named
          ? {
              status: 'PASS',
              evidence: `"${named}" is listed for both Gemini 3.8 TTS models (${TTS_DOCS.url}, updated ${TTS_DOCS.pageUpdated}, read ${TTS_DOCS.checked})`,
            }
          : {
              status: 'FAIL',
              evidence: `not listed by name in the TTS language table (${TTS_DOCS.url}, read ${TTS_DOCS.checked}); speech can only approximate it with the parent-language voice`,
            };
      }
      const own = observations.filter(
        (observation) => observation.row === row && observation.column === column,
      );
      if (own.length > 0) {
        return {
          status: aggregateStatus(own.map((observation) => observation.status)),
          evidence: [...new Set(own.map((observation) => observation.evidence))].join('; '),
        };
      }
      if (column === 'answersInDialect' && isLanguage(row)) {
        const language = observations.filter(
          (o) => o.row === row && o.column === 'answersInLanguage',
        );
        if (language.length) {
          return {
            status: aggregateStatus(language.map((o) => o.status)),
            evidence: 'standard-language row: same as "answers in correct language"',
          };
        }
      }
      if (column === 'identifiesDialect') {
        return {
          status: 'NOT-TESTED',
          evidence: 'needs labelled real-speaker clips in eval/audio (none supplied)',
        };
      }
      if (column === 'understandsSpeech') {
        return { status: 'NOT-TESTED', evidence: 'no clip for this row was run' };
      }
      return { status: 'NOT-TESTED', evidence: 'no observation in this run' };
    };
    return {
      row,
      label,
      cells: Object.fromEntries(MATRIX_COLUMNS.map((column) => [column, cell(column)])) as Record<
        MatrixColumn,
        MatrixCell
      >,
    };
  });
}

const md = (text: string) => text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

function checkTable(checks: Check[]): string {
  if (checks.length === 0) return '_No checks ran._\n';
  const lines = ['| Status | Check | Result | Evidence |', '|---|---|---|---|'];
  for (const check of checks) {
    lines.push(
      `| ${check.status} | ${md(check.title)} | ${md(check.detail)} | ${md(check.evidence.join('<br>'))} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

/** The plain-language verdict for one matrix row. */
export function rowVerdict(row: MatrixRow): string {
  const c = row.cells;
  const proven = MATRIX_COLUMNS.filter(
    (column) => c[column].status === 'PASS' && column !== 'ttsNamesLanguage',
  );
  const human = MATRIX_COLUMNS.filter((column) => c[column].status === 'NEEDS-HUMAN');
  const untested = MATRIX_COLUMNS.filter((column) =>
    ['NOT-TESTED', 'MOCK-ONLY', 'SYNTHETIC-ONLY'].includes(c[column].status),
  );
  const failed = MATRIX_COLUMNS.filter(
    (column) => c[column].status === 'FAIL' && column !== 'ttsNamesLanguage',
  );
  const names = (columns: readonly MatrixColumn[]) =>
    columns.map((column) => MATRIX_COLUMN_TITLES[column].toLowerCase()).join(', ');
  const parts: string[] = [];
  parts.push(
    proven.length
      ? `Shown to work in this run: ${names(proven)}.`
      : 'Nothing was shown to work with real models in this run.',
  );
  if (failed.length) parts.push(`Failed: ${names(failed)}.`);
  if (human.length) parts.push(`Needs a native speaker: ${names(human)}.`);
  if (untested.length)
    parts.push(`Not proven (untested, mock or synthetic only): ${names(untested)}.`);
  if (c.ttsNamesLanguage.status === 'FAIL')
    parts.push(
      'TTS does not name this variety, so its speech can only be a parent-language approximation.',
    );
  return parts.join(' ');
}

export interface KiKehVerdict {
  text: string;
  evidence: string[];
}

export function renderReport(
  results: AuditResults,
  extras: { kiKeh: KiKehVerdict; comparison?: string },
): string {
  const out: string[] = [];
  out.push('# Pipeline audit');
  out.push('');
  out.push(
    `Generated ${results.generatedAt} by \`npm run audit -w server\` (label **${results.label}**) on branch \`${results.git.branch}\` at \`${results.git.commit}\`${results.git.dirty ? ' (uncommitted changes present)' : ''}.`,
  );
  out.push('');
  out.push(
    'Statuses: PASS (ran and met the check), FAIL, PARTIAL, MOCK-ONLY (fixtures, proves nothing about the real pipeline), SYNTHETIC-ONLY (machine-generated audio, weak evidence), NEEDS-HUMAN (code cannot judge it), NOT-TESTED (with the reason). Nothing here is called PASS without a run.',
  );
  out.push('');
  out.push('## How this run was made');
  out.push('');
  out.push('| Worker | Purpose | USE_MOCKS | Gemini key | API access |');
  out.push('|---|---|---|---|---|');
  const purposes: Record<string, string> = {
    configured: 'Stages B–H and live J, exactly as the environment is configured',
    'mock-reference':
      'USE_MOCKS=true, only to reproduce mock-mode behaviour for the "ki keh raho he" verdict',
    fake: 'Stages I and J (shape): USE_MOCKS=false, no key, fake Gemini backend',
  };
  for (const worker of results.workers) {
    out.push(
      `| ${worker.worker} | ${md(purposes[worker.worker] ?? '')} | ${worker.useMocks.join(', ') || 'off'} | ${worker.keyConfigured ? 'set' : 'not set'} | ${worker.transport === 'http' ? 'real Express app (HTTP)' : 'controllers called in-process'} |`,
    );
  }
  out.push('');
  if (results.sandboxNotes.length) {
    out.push('**Environment notes**');
    out.push('');
    for (const note of results.sandboxNotes) out.push(`- ${note}`);
    out.push('');
  }
  if (extras.comparison) {
    out.push('## Before / after');
    out.push('');
    out.push(extras.comparison);
    out.push('');
  }

  out.push('## Regional readiness matrix');
  out.push('');
  out.push(`| Row | ${MATRIX_COLUMNS.map((column) => MATRIX_COLUMN_TITLES[column]).join(' | ')} |`);
  out.push(`|---|${MATRIX_COLUMNS.map(() => '---').join('|')}|`);
  for (const row of results.matrix) {
    out.push(
      `| ${md(row.label)} | ${MATRIX_COLUMNS.map((column) => row.cells[column].status).join(' | ')} |`,
    );
  }
  out.push('');
  out.push('<details><summary>Evidence for every cell</summary>');
  out.push('');
  for (const row of results.matrix) {
    out.push(`**${row.label}**`);
    out.push('');
    for (const column of MATRIX_COLUMNS) {
      out.push(
        `- ${MATRIX_COLUMN_TITLES[column]}: ${row.cells[column].status} — ${row.cells[column].evidence}`,
      );
    }
    out.push('');
  }
  out.push('</details>');
  out.push('');
  out.push('### Verdict per row');
  out.push('');
  for (const row of results.matrix) out.push(`- **${row.label}:** ${rowVerdict(row)}`);
  out.push('');

  out.push('## "ki keh raho he"');
  out.push('');
  out.push(extras.kiKeh.text);
  out.push('');
  for (const evidence of extras.kiKeh.evidence) out.push(`- ${evidence}`);
  out.push('');

  if (results.deployed) {
    out.push('## Deployed app');
    out.push('');
    out.push(`${results.deployed.status}: ${results.deployed.detail}`);
    out.push('');
    for (const evidence of results.deployed.evidence) out.push(`- ${evidence}`);
    out.push('');
  }

  out.push('## Stages');
  out.push('');
  out.push('| Stage | Status | Mode | Checks | Note |');
  out.push('|---|---|---|---|---|');
  for (const stage of results.stages) {
    out.push(
      `| ${stage.stage} ${md(stage.name)} | ${stage.status} | ${stage.mode} | ${stage.checks.length} | ${md(stage.reason ?? '')} |`,
    );
  }
  out.push('');
  for (const stage of results.stages) {
    out.push(`### ${stage.stage}. ${stage.name} — ${stage.status}`);
    out.push('');
    if (stage.reason) {
      out.push(`_${stage.reason}_`);
      out.push('');
    }
    const summary = stage.data?.summary as Record<string, string> | undefined;
    if (summary) {
      for (const [key, value] of Object.entries(summary)) out.push(`- ${key}: ${value}`);
      out.push('');
    }
    out.push(checkTable(stage.checks));
  }

  const flat = results.stages.flatMap((stage) =>
    stage.checks.length ? stage.checks.map((check) => ({ stage: stage.stage, ...check })) : [],
  );
  const listOf = (status: Status) => {
    const fromChecks = flat
      .filter((check) => check.status === status)
      .map((check) => `- ${check.stage} · ${check.title}: ${check.detail}`);
    const fromStages = results.stages
      .filter((stage) => stage.checks.length === 0 && stage.status === status)
      .map((stage) => `- ${stage.stage} · ${stage.name} (whole stage): ${stage.reason ?? ''}`);
    return [...fromStages, ...fromChecks];
  };
  out.push('## NOT-TESTED');
  out.push('');
  out.push(...(listOf('NOT-TESTED').length ? listOf('NOT-TESTED') : ['- none']));
  out.push('');
  out.push('## NEEDS-HUMAN');
  out.push('');
  out.push(...(listOf('NEEDS-HUMAN').length ? listOf('NEEDS-HUMAN') : ['- none']));
  out.push('');
  out.push('Full machine-readable results: `audit/results.json`.');
  out.push('');
  return out.join('\n');
}

/** Before/after table of stage statuses and matrix cells. */
export function compareRuns(before: AuditResults, after: AuditResults): string {
  const lines = ['| Stage | Before | After |', '|---|---|---|'];
  const ids = [...new Set([...before.stages, ...after.stages].map((stage) => stage.stage))].sort();
  for (const id of ids) {
    const a = before.stages.find((stage) => stage.stage === id);
    const b = after.stages.find((stage) => stage.stage === id);
    lines.push(
      `| ${id} ${md(b?.name ?? a?.name ?? '')} | ${a?.status ?? '-'} | ${b?.status ?? '-'} |`,
    );
  }
  const changes: string[] = [];
  for (const row of after.matrix) {
    const old = before.matrix.find((candidate) => candidate.row === row.row);
    for (const column of MATRIX_COLUMNS) {
      const was = old?.cells[column].status ?? '-';
      const now = row.cells[column].status;
      if (was !== now)
        changes.push(`| ${md(row.label)} | ${MATRIX_COLUMN_TITLES[column]} | ${was} | ${now} |`);
    }
  }
  const matrix = changes.length
    ? ['', '| Row | Column | Before | After |', '|---|---|---|---|', ...changes].join('\n')
    : '\nNo matrix cell changed status.';
  return `Baseline: ${before.label} at \`${before.git.commit}\` (${before.generatedAt}). Now: ${after.label} at \`${after.git.commit}\`.\n\n${lines.join('\n')}\n${matrix}`;
}
