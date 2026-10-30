import type { HealthResponse } from '@gram-saathi/shared';
import type { Request, Response } from 'express';
import { getHealthStatus } from './service';

/** GET /api/health */
export function getHealth(_req: Request, res: Response<HealthResponse>): void {
  res.json(getHealthStatus());
}
