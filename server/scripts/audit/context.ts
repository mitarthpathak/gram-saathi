/** Shared state of one audit worker process. */
import { performance } from 'node:perf_hooks';
import { env, isMocked, type MockableModule } from '../../src/config/env';
import type { GeminiCallRecord } from '../../src/lib/geminiClient';
import { aggregateStatus } from './checks';
import type { GoldSet } from './goldset';
import type { KnowledgeBaseView } from './kb';
import type { Transport } from './transport';
import type { Check, RegionalObservation, RunMode, StageId, StageResult, Status } from './types';

export interface WorkerContext {
  transport: Transport;
  gold: GoldSet;
  kb: KnowledgeBaseView;
  /** Every Gemini call seen by the observer, in order. */
  calls: GeminiCallRecord[];
  regional: RegionalObservation[];
  /** Request latencies (ms) per path, for Stage J. */
  latencies: { text: number[]; voice: number[]; tts: number[] };
  /** Repo root, for files the audit writes (eval/, audit/). */
  repoRoot: string;
  /** Results shared between stages (e.g. dialect answers for TTS). */
  shared: {
    dialectAnswers: Map<string, string>;
    standardAnswerHi?: string;
  };
}

/**
 * "mock" when any module the stage depends on is mocked, "none" when real mode lacks a key,
 * otherwise "real".
 */
export function stageMode(modules: MockableModule[]): 'mock' | 'real' | 'none' {
  if (modules.some((module) => isMocked(module))) return 'mock';
  return env.GEMINI_API_KEY ? 'real' : 'none';
}

export const NO_KEY_REASON =
  'Real mode needs GEMINI_API_KEY; it is not set in this environment (no real model call was made).';

export function mockedModulesText(modules: MockableModule[]): string {
  const mocked = modules.filter((module) => isMocked(module));
  return `USE_MOCKS covers ${mocked.join(', ')}: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline.`;
}

/** Runs one stage; an exception becomes NOT-TESTED with the error, never a crash. */
export async function runStage(
  stage: StageId,
  name: string,
  mode: RunMode,
  body: () => Promise<{
    checks: Check[];
    data?: Record<string, unknown>;
    status?: Status;
    reason?: string;
  }>,
): Promise<StageResult> {
  const startedAt = performance.now();
  try {
    const result = await body();
    return {
      stage,
      name,
      mode,
      status: result.status ?? aggregateStatus(result.checks.map((check) => check.status)),
      reason: result.reason,
      checks: result.checks,
      data: result.data,
      durationMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      stage,
      name,
      mode,
      status: 'NOT-TESTED',
      reason: `stage stopped by an error: ${error instanceof Error ? error.message : String(error)}`,
      checks: [],
      durationMs: Math.round(performance.now() - startedAt),
    };
  }
}

/** A stage that was not run at all. */
export function skippedStage(
  stage: StageId,
  name: string,
  mode: RunMode,
  reason: string,
): StageResult {
  return { stage, name, mode, status: 'NOT-TESTED', reason, checks: [], durationMs: 0 };
}

export function sessionId(prefix: string): string {
  return `audit-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** In mock mode every result is MOCK-ONLY, whatever the check observed. */
export function asMode(status: Status, mode: 'mock' | 'real' | 'none'): Status {
  if (mode === 'mock') return 'MOCK-ONLY';
  if (mode === 'none') return 'NOT-TESTED';
  return status;
}
