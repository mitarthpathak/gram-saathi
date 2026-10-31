import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { dialectEnvOverrides, env, PATHS } from '../../config/env';
import { logger } from '../../lib/logger';

const calibrationSchema = z.object({
  version: z.literal(1),
  ensembleSize: z.number().int().min(1).max(3),
  minimumVotes: z.number().int().min(1).max(3),
  targetPrecision: z.number().min(0).max(1),
  rows: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export type DialectCalibration = z.infer<typeof calibrationSchema>;

export interface CalibrationScore {
  ensembleSize: number;
  minimumVotes: number;
  coverage: number;
  answeredPrecision: number | null;
  macroF1: number;
}

/** Maximize coverage among configurations meeting the precision target; ties are stable. */
export function chooseCalibration(
  scores: readonly CalibrationScore[],
  targetPrecision: number,
): CalibrationScore | undefined {
  return scores
    .filter(
      (score) => score.answeredPrecision !== null && score.answeredPrecision >= targetPrecision,
    )
    .sort(
      (a, b) =>
        b.coverage - a.coverage ||
        (b.answeredPrecision ?? 0) - (a.answeredPrecision ?? 0) ||
        a.ensembleSize - b.ensembleSize ||
        a.minimumVotes - b.minimumVotes,
    )[0];
}

let loaded = false;
let calibration: DialectCalibration | undefined;

/** Loads an optional offline calibration once. A malformed file is ignored with a warning. */
export function getDialectCalibration(): DialectCalibration | undefined {
  if (!loaded) {
    loaded = true;
    try {
      calibration = calibrationSchema.parse(
        JSON.parse(readFileSync(PATHS.dialectCalibration, 'utf8')),
      );
    } catch (error) {
      if (isMissingFile(error)) return undefined;
      logger.warn('Ignoring invalid data/dialects/calibration.json; using configured defaults.');
    }
  }
  return calibration;
}

/** Env values explicitly supplied by an operator win over the last offline calibration. */
export function getDialectSettings(): { ensembleSize: number; minimumVotes: number } {
  const saved = getDialectCalibration();
  return resolveDialectSettings(
    { ensembleSize: env.DIALECT_ENSEMBLE_SIZE, minimumVotes: env.DIALECT_MIN_VOTES },
    saved,
    dialectEnvOverrides,
  );
}

export function resolveDialectSettings(
  defaults: { ensembleSize: number; minimumVotes: number },
  saved: Pick<DialectCalibration, 'ensembleSize' | 'minimumVotes'> | undefined,
  overrides: { ensembleSize: boolean; minimumVotes: boolean },
): { ensembleSize: number; minimumVotes: number } {
  return {
    ensembleSize: !overrides.ensembleSize && saved ? saved.ensembleSize : defaults.ensembleSize,
    minimumVotes: !overrides.minimumVotes && saved ? saved.minimumVotes : defaults.minimumVotes,
  };
}

export function resetDialectCalibrationCache(): void {
  loaded = false;
  calibration = undefined;
}

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
