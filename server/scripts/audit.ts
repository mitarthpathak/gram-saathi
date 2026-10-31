/**
 * Honest pipeline audit: what really works, per language and dialect, with evidence.
 *
 *   npm run audit -w server                       # writes docs/PIPELINE_AUDIT.md + audit/results.json
 *   npm run audit -w server -- --baseline         # also keeps *.baseline.* copies
 *   npm run audit -w server -- --skip-static      # skip Stage A (install/typecheck/lint/test/build)
 *   npm run audit -w server -- --label after-phase-5
 *
 * Optional env: AUDIT_BASE_URL (deployed app to probe), AUDIT_CLIENT_URL (Stage H),
 * AUDIT_TEXT_PER_LANGUAGE (Stage D questions per language, default 3), AUDIT_ENV_NOTE (a note
 * about the machine the audit ran on), AUDIT_WORKER_TIMEOUT_MS.
 *
 * The run is split into worker processes so that each has a clean environment:
 * - "configured": the API exactly as .env configures it (real or mock); Stages B–H and live J;
 * - "mock-reference": USE_MOCKS=true, only to reproduce mock-mode behaviour of the reported bug;
 * - "fake": NODE_ENV=test, USE_MOCKS=false, no key, fake Gemini backend; Stages I and J (shape).
 * A worker that crashes turns its stages into NOT-TESTED with the error; the audit never crashes.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { env } from '../src/config/env';
import { getDialectRegistry } from '../src/modules/dialect/registry';
import { aggregateStatus, excerpt } from './audit/checks';
import {
  buildMatrix,
  compareRuns,
  mergeStages,
  renderReport,
  type KiKehVerdict,
} from './audit/report';
import type {
  AuditResults,
  Check,
  DeployedCheck,
  StageId,
  StageResult,
  WorkerOutput,
} from './audit/types';

const serverRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverRoot, '..');
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const STAGE_NAMES: Record<StageId, string> = {
  A: 'Static checks',
  B: 'Real-mode preflight',
  C: 'Retrieval',
  D: 'Text answers (POST /api/chat/query)',
  E: 'Dialect text',
  F: 'Speech in (POST /api/voice/query)',
  G: 'Speech out (POST /api/tts)',
  H: 'Browser end-to-end mic test (optional)',
  I: 'Robustness and error codes',
  J: 'Latency and cost shape',
};

// ---------------------------------------------------------------------------
// Stage A: static checks with the repo's own tooling
// ---------------------------------------------------------------------------

function run(command: string, timeoutMs = 15 * 60_000) {
  const result = spawnSync(command, {
    cwd: repoRoot,
    shell: true,
    encoding: 'utf8',
    timeout: timeoutMs,
    env: process.env,
  });
  return { code: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

const tail = (text: string, lines = 6) => text.trim().split('\n').slice(-lines).join(' ⏎ ');

function stageA(): StageResult {
  const startedAt = Date.now();
  const checks: Check[] = [];
  const bin = (name: string) => path.join(repoRoot, 'node_modules/.bin', name);
  const missing = ['tsc', 'vitest', 'eslint', 'vite', 'tsx'].filter(
    (name) => !existsSync(bin(name)) && !existsSync(`${bin(name)}.cmd`),
  );
  if (missing.length > 0) {
    const reason = `Dependencies are not installed (node_modules/.bin lacks ${missing.join(', ')}). Run \`npm install\` first; no static result can be claimed without the repo's own toolchain.`;
    return {
      stage: 'A',
      name: STAGE_NAMES.A,
      status: 'NOT-TESTED',
      mode: 'static',
      reason,
      checks: [],
      durationMs: Date.now() - startedAt,
    };
  }
  const simple = (id: string, title: string, command: string) => {
    const result = run(command);
    const errors = (result.output.match(/error TS\d+/g) ?? []).length;
    checks.push({
      id,
      title,
      status: result.code === 0 ? 'PASS' : 'FAIL',
      detail:
        result.code === 0
          ? `\`${command}\` exited 0.`
          : `\`${command}\` exited ${result.code}${errors ? ` (${errors} TypeScript errors)` : ''}: ${excerpt(tail(result.output), 400)}`,
      evidence: [`\`${command}\``],
    });
  };
  simple('A-install', 'Dependencies resolve (npm ls)', 'npm ls --workspaces --depth=0');
  simple('A-typecheck', 'Typecheck, all workspaces', 'npm run typecheck');
  simple('A-lint', 'ESLint', 'npm run lint');
  simple('A-format', 'Prettier check (CI step)', 'npm run format:check');

  const report = path.join(tmpdir(), `gram-saathi-vitest-${process.pid}.json`);
  const tests = run(`npm test -w server -- --reporter=json --outputFile=${JSON.stringify(report)}`);
  try {
    const parsed = JSON.parse(readFileSync(report, 'utf8')) as {
      numTotalTests: number;
      numPassedTests: number;
      numFailedTests: number;
      testResults: { name: string; assertionResults: { fullName: string; status: string }[] }[];
    };
    const failed = parsed.testResults.flatMap((file) =>
      file.assertionResults
        .filter((test) => test.status === 'failed')
        .map((test) => `${path.basename(file.name)}: ${test.fullName}`),
    );
    checks.push({
      id: 'A-tests',
      title: 'Server unit tests (vitest)',
      status: parsed.numFailedTests === 0 ? 'PASS' : 'FAIL',
      detail: `${parsed.numPassedTests}/${parsed.numTotalTests} passed, ${parsed.numFailedTests} failed${failed.length ? `: ${failed.slice(0, 10).join('; ')}` : ''}.`,
      evidence: ['`npm test -w server`'],
      data: {
        total: parsed.numTotalTests,
        passed: parsed.numPassedTests,
        failed: parsed.numFailedTests,
        failing: failed,
      },
    });
  } catch {
    checks.push({
      id: 'A-tests',
      title: 'Server unit tests (vitest)',
      status: 'FAIL',
      detail: `No vitest JSON report (exit ${tests.code}): ${excerpt(tail(tests.output), 400)}`,
      evidence: ['`npm test -w server`'],
    });
  } finally {
    rmSync(report, { force: true });
  }
  simple('A-build', 'Build, all workspaces', 'npm run build');
  return {
    stage: 'A',
    name: STAGE_NAMES.A,
    status: aggregateStatus(checks.map((check) => check.status)),
    mode: 'static',
    checks,
    durationMs: Date.now() - startedAt,
  };
}

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

function tsxCli(): string {
  return require.resolve('tsx/cli', { paths: [serverRoot, repoRoot] });
}

function runWorker(
  file: string,
  kind: string,
  extraEnv: Record<string, string>,
  timeoutMs: number,
): Promise<{ output?: WorkerOutput; error?: string }> {
  const outFile = path.join(tmpdir(), `gram-saathi-audit-${process.pid}-${kind}.json`);
  rmSync(outFile, { force: true });
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [tsxCli(), path.join(__dirname, 'audit', file), outFile, kind],
      {
        cwd: serverRoot,
        env: { ...process.env, ...extraEnv },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => process.stdout.write(chunk));
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (existsSync(outFile)) {
        try {
          resolve({ output: JSON.parse(readFileSync(outFile, 'utf8')) as WorkerOutput });
          rmSync(outFile, { force: true });
          return;
        } catch (error) {
          resolve({ error: `unreadable worker output: ${String(error)}` });
          return;
        }
      }
      resolve({
        error: `worker "${kind}" exited ${code ?? 'by signal'} without results: ${excerpt(tail(stderr, 8), 500)}`,
      });
    });
  });
}

function failedWorkerStages(stages: StageId[], error: string): StageResult[] {
  return stages.map((stage) => ({
    stage,
    name: STAGE_NAMES[stage],
    status: 'NOT-TESTED',
    mode: 'none',
    reason: error,
    checks: [],
    durationMs: 0,
  }));
}

// ---------------------------------------------------------------------------
// Deployed app
// ---------------------------------------------------------------------------

async function probeDeployed(baseUrl: string): Promise<DeployedCheck> {
  const base = baseUrl.replace(/\/+$/, '');
  const get = async (route: string) => {
    const response = await fetch(`${base}${route}`, { signal: AbortSignal.timeout(15_000) });
    return {
      status: response.status,
      body: (await response.json().catch(() => undefined)) as unknown,
    };
  };
  try {
    const health = await get('/api/health');
    const mocks = (health.body as { mocks?: boolean } | undefined)?.mocks;
    const faq = await get('/api/faq/top?lang=hi').catch(() => undefined);
    const ids = ((faq?.body as { items?: { id: string }[] } | undefined)?.items ?? []).map(
      (item) => item.id,
    );
    const faqLooksMocked = ids.length > 0 && ids.every((id) => /^faq-\d+$/.test(id));
    return {
      baseUrl: base,
      status: 'PASS',
      detail: `GET /api/health → HTTP ${health.status}, mocks=${String(mocks)} (true means at least one module is mocked). GET /api/faq/top?lang=hi → ids ${ids.join(', ') || '(none)'}${faqLooksMocked ? ' — the id format of the mock FAQ (real prewarmed ids look like "pm-kisan-amount")' : ''}.`,
      evidence: [
        `${base}/api/health → ${excerpt(JSON.stringify(health.body), 200)}`,
        `${base}/api/faq/top?lang=hi → ids ${ids.join(', ')}`,
      ],
      mocks,
      faqLooksMocked,
    };
  } catch (error) {
    return {
      baseUrl: base,
      status: 'NOT-TESTED',
      detail: `Could not reach the deployed app: ${String(error)}`,
      evidence: [],
    };
  }
}

// ---------------------------------------------------------------------------
// The "ki keh raho he" verdict
// ---------------------------------------------------------------------------

function kiKehVerdict(outputs: WorkerOutput[], deployed?: DeployedCheck): KiKehVerdict {
  const evidence: string[] = [];
  const lines: string[] = [];
  const typed = (worker: WorkerOutput) =>
    worker.stages
      .find((stage) => stage.stage === 'D')
      ?.checks.find((check) => check.id === 'D-clarify-fresh-ki-keh-raho-he');
  const spoken = (worker: WorkerOutput) =>
    worker.stages
      .find((stage) => stage.stage === 'F')
      ?.checks.find((check) => check.id === 'F-mock-hi');

  let realOutcome: boolean | undefined;
  let mockTyped: boolean | undefined;
  let mockSpokenTranscript: string | undefined;
  for (const worker of outputs) {
    const check = typed(worker);
    if (check) {
      const mode = String(check.data?.mode ?? '');
      const wrong = Boolean(check.data?.wrongScheme);
      evidence.push(
        `${worker.worker} worker, ${mode} mode, typed: ${check.status} — ${check.evidence.join(' ')}`,
      );
      if (mode === 'real') realOutcome = wrong;
      if (mode === 'mock') mockTyped = wrong;
    }
    const voice = spoken(worker);
    if (voice?.data?.transcript) {
      mockSpokenTranscript = String(voice.data.transcript);
      evidence.push(
        `${worker.worker} worker, mock voice with 1.5 s of silence: ${voice.evidence.join(' ')}`,
      );
    }
  }
  if (realOutcome === undefined) {
    lines.push(
      'Real mode (this branch, with the intent router): NOT-TESTED — no run with a Gemini key. The router prompt lists "ki keh raho he" as a clarification, but a prompt is not proof.',
    );
  } else {
    lines.push(
      realOutcome
        ? 'Real mode (this branch): REPRODUCED — a typed "ki keh raho he" still got a scheme answer.'
        : 'Real mode (this branch): not reproduced — a typed "ki keh raho he" got no scheme answer.',
    );
  }
  if (mockTyped !== undefined) {
    lines.push(
      mockTyped
        ? 'Mock mode, typed: REPRODUCED — the mock pipeline returned a scheme answer.'
        : 'Mock mode, typed: not reproduced — the mock keyword search finds no scheme, so the fixed not-found text is returned (no PM-KISAN answer).',
    );
  }
  if (mockSpokenTranscript) {
    lines.push(
      `Mock mode, spoken: REPRODUCED for any recording — the mock speech-to-text ignores the audio and returns the canned question “${mockSpokenTranscript}”, which gets the canned formal-Hindi scheme answer.`,
    );
  }
  if (deployed) {
    evidence.push(`deployed: ${deployed.detail}`);
    if (deployed.mocks) {
      lines.push(
        `Deployed app (${deployed.baseUrl}): reports mocks=true${deployed.faqLooksMocked ? ' and serves the mock FAQ' : ''}, so it is running fixtures. The canned PM-KISAN answer in formal Hindi matches the mock voice path; a typed message cannot produce it with main's mock code. mocks=true alone does not prove the chat module itself is mocked, so check the Vercel USE_MOCKS value to close this.`,
      );
    }
  }
  lines.push(
    'Fix status: the intent router exists only in real mode; USE_MOCKS=true must behave exactly as before (R8), so mock mode keeps its canned voice answers.',
  );
  return { text: lines.map((line) => `- ${line}`).join('\n'), evidence };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function gitInfo() {
  const read = (command: string) => run(command, 10_000).output.trim();
  return {
    branch: read('git rev-parse --abbrev-ref HEAD') || 'unknown',
    commit: read('git rev-parse --short HEAD') || 'unknown',
    dirty: read('git status --porcelain --untracked-files=no').length > 0,
  };
}

async function main(): Promise<void> {
  const label = option('label') ?? (flag('baseline') ? 'baseline' : 'run');
  const sandboxNotes: string[] = [];
  if (process.env.AUDIT_ENV_NOTE) sandboxNotes.push(process.env.AUDIT_ENV_NOTE);

  const stages: StageResult[] = [];
  if (flag('skip-static')) {
    stages.push({
      stage: 'A',
      name: STAGE_NAMES.A,
      status: 'NOT-TESTED',
      mode: 'static',
      reason: 'skipped with --skip-static',
      checks: [],
      durationMs: 0,
    });
  } else {
    console.log('Stage A: static checks…');
    stages.push(stageA());
  }

  const timeout = Number(process.env.AUDIT_WORKER_TIMEOUT_MS ?? 45 * 60_000);
  const outputs: WorkerOutput[] = [];
  console.log('Configured worker (Stages B–H)…');
  const configured = await runWorker('worker.ts', 'configured', {}, timeout);
  if (configured.output) outputs.push(configured.output);
  else
    stages.push(
      ...failedWorkerStages(
        ['B', 'C', 'D', 'E', 'F', 'G', 'H'],
        configured.error ?? 'unknown error',
      ),
    );

  const configuredMocksVoice =
    env.USE_MOCKS.has('chat') && env.USE_MOCKS.has('voice') && env.USE_MOCKS.has('rag');
  if (!configuredMocksVoice) {
    console.log('Mock-reference worker…');
    const reference = await runWorker(
      'worker.ts',
      'mock-reference',
      { USE_MOCKS: 'true' },
      10 * 60_000,
    );
    if (reference.output) outputs.push(reference.output);
    else sandboxNotes.push(`Mock-reference worker failed: ${reference.error}`);
  }

  console.log('Fake-backend worker (Stages I, J)…');
  const fake = await runWorker(
    'fakeWorker.ts',
    'fake',
    {
      NODE_ENV: 'test',
      USE_MOCKS: 'false',
      GEMINI_API_KEY: '',
      GEMINI_FALLBACK_MODEL: 'none',
      GEMINI_MAX_RETRIES: '0',
      RATE_LIMIT_PER_MINUTE: '0',
    },
    10 * 60_000,
  );
  if (fake.output) outputs.push(fake.output);
  else stages.push(...failedWorkerStages(['I', 'J'], fake.error ?? 'unknown error'));

  for (const output of outputs) {
    // The mock-reference worker only supports the verdict; its checks stay out of the stages.
    if (output.worker !== 'mock-reference') stages.push(...output.stages);
  }

  const baseUrl = process.env.AUDIT_BASE_URL;
  const deployed = baseUrl ? await probeDeployed(baseUrl) : undefined;

  const regional = outputs
    .filter((output) => output.worker === 'configured')
    .flatMap((output) => output.regional);
  const results: AuditResults = {
    version: 1,
    generatedAt: new Date().toISOString(),
    git: gitInfo(),
    label,
    workers: outputs.map((output) => ({ worker: output.worker, ...output.environment })),
    stages: mergeStages(stages),
    matrix: buildMatrix(regional, getDialectRegistry()),
    deployed,
    sandboxNotes,
  };
  for (const output of outputs) {
    if (output.environment.transport === 'in-process') {
      sandboxNotes.push(`${output.worker} worker: ${output.environment.transportNote}`);
    }
  }

  const kiKeh = kiKehVerdict(outputs, deployed);
  const baselineFile = path.join(repoRoot, 'audit/results.baseline.json');
  const comparison =
    !flag('baseline') && existsSync(baselineFile)
      ? compareRuns(JSON.parse(readFileSync(baselineFile, 'utf8')) as AuditResults, results)
      : undefined;
  const markdown = renderReport(results, { kiKeh, comparison });

  mkdirSync(path.join(repoRoot, 'audit'), { recursive: true });
  writeFileSync(
    path.join(repoRoot, 'audit/results.json'),
    `${JSON.stringify({ ...results, kiKeh }, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(path.join(repoRoot, 'docs/PIPELINE_AUDIT.md'), markdown, 'utf8');
  if (flag('baseline')) {
    writeFileSync(baselineFile, `${JSON.stringify({ ...results, kiKeh }, null, 2)}\n`, 'utf8');
    writeFileSync(path.join(repoRoot, 'docs/PIPELINE_AUDIT.baseline.md'), markdown, 'utf8');
  }
  console.log(
    `\nWrote docs/PIPELINE_AUDIT.md and audit/results.json${flag('baseline') ? ' (+ baseline copies)' : ''}.`,
  );
  for (const stage of results.stages)
    console.log(`  ${stage.stage} ${stage.status.padEnd(14)} ${stage.name}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
