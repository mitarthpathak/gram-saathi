import type { LiveTokenResponse } from '@gram-saathi/shared';

export function mockLiveToken(now = new Date(), ttlSeconds = 600): LiveTokenResponse {
  const newSessionExpiresAt = new Date(now.getTime() + 60_000).toISOString();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  return { token: 'mock', model: 'mock', expiresAt, newSessionExpiresAt, mock: true };
}
