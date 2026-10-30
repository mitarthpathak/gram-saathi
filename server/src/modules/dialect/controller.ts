import type { DialectsResponse } from '@gram-saathi/shared';
import type { Request, Response } from 'express';
import { listDialects } from './service';

/** GET /api/dialects */
export function getDialects(_req: Request, res: Response<DialectsResponse>): void {
  res.json({ items: listDialects() });
}
