/**
 * Audit worker: runs Stages B–H (and the latency part of J) against the API exactly as the
 * current environment configures it, then writes a WorkerOutput JSON file.
 * Started by scripts/audit.ts:  tsx scripts/audit/worker.ts <out.json> <configured|mock-reference>
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { env } from '../../src/config/env';
import { setGeminiObserver, type GeminiCallRecord } from '../../src/lib/geminiClient';
import { distribution, formatDistribution, percentile } from './checks';
import { runStage, type WorkerContext } from './context';
import { loadGoldSet } from './goldset';
import { readKnowledgeBase } from './kb';
import { stageF, stageG, stageH } from './stagesSpeech';
import { stageB, stageC, stageD, stageE } from './stagesText';
import { openTransport } from './transport';
import type { Check, StageResult, WorkerOutput } from './types';

async function main(): Promise<void> {
  const [outFile, kind = 'configured'] = process.argv.slice(2);
  if (!outFile) throw new Error('usage: worker.ts <out.json> <configured|mock-reference>');
  const worker = kind === 'mock-reference' ? 'mock-reference' : 'configured';

  const calls: GeminiCallRecord[] = [];
  setGeminiObserver((record) => calls.push(record));
  const transport = await openTransport();
  const ctx: WorkerContext = {
    transport,
    gold: loadGoldSet(),
    kb: readKnowledgeBase(),
    calls,
    regional: [],
    latencies: { text: [], voice: [], tts: [] },
    repoRoot: path.resolve(__dirname, '../../..'),
    shared: { dialectAnswers: new Map() },
  };

  const stages: StageResult[] = [];
  try {
    if (worker === 'mock-reference') {
      // Only what reproduces the owner's report in mock mode.
      stages.push(await stageD(ctx, 'clarify'));
      stages.push(await stageF(ctx));
    } else {
      stages.push(await stageB(ctx));
      stages.push(await stageC(ctx));
      stages.push(await stageD(ctx));
      stages.push(await stageE(ctx));
      stages.push(await stageF(ctx));
      stages.push(await stageG(ctx));
      stages.push(await stageH(ctx));
      stages.push(await latencyStage(ctx));
    }
  } finally {
    await transport.close();
  }

  const output: WorkerOutput = {
    worker,
    environment: {
      useMocks: [...env.USE_MOCKS],
      keyConfigured: Boolean(env.GEMINI_API_KEY),
      transport: transport.kind,
      transportNote: transport.note,
      models: {
        chat: env.GEMINI_CHAT_MODEL,
        fallback: env.GEMINI_FALLBACK_MODEL,
        audio: env.GEMINI_AUDIO_MODEL,
        embed: env.GEMINI_EMBED_MODEL,
        tts: env.GEMINI_TTS_MODEL,
      },
    },
    stages,
    regional: ctx.regional,
  };
  writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf8');
}

/** Stage J, live part: request latencies measured while the other stages ran. */
function latencyStage(ctx: WorkerContext): Promise<StageResult> {
  const live = !env.USE_MOCKS.has('chat') && Boolean(env.GEMINI_API_KEY);
  return runStage('J', 'Latency and cost shape', live ? 'real' : 'none', async () => {
    const checks: Check[] = [];
    for (const [route, values] of Object.entries(ctx.latencies)) {
      if (!live || values.length === 0) {
        checks.push({
          id: `J-latency-${route}`,
          title: `${route} request latency (p50 / p95)`,
          status: 'NOT-TESTED',
          detail: live
            ? 'No live request on this path in this run.'
            : 'Latency is only meaningful against real Gemini calls; this run made none on this path.',
          evidence: [],
        });
        continue;
      }
      checks.push({
        id: `J-latency-${route}`,
        title: `${route} request latency (p50 / p95)`,
        status: 'PASS',
        detail: `p50 ${percentile(values, 50)} ms, p95 ${percentile(values, 95)} ms over ${values.length} live requests (${formatDistribution(distribution(values), 0)}). Informational: no latency budget is defined.`,
        evidence: ['results.json stages.J'],
        data: { p50: percentile(values, 50), p95: percentile(values, 95), count: values.length },
      });
    }
    return { checks };
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
