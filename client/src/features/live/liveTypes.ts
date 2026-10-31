import type { LanguageCode } from '@gram-saathi/shared';

// TODO(contract): import from @gram-saathi/shared after B1 merges.
export interface LiveTokenRequest {
  sessionId: string;
  language?: LanguageCode;
  dialectHint?: string;
}

export interface LiveTokenResponse {
  token: string;
  model: string;
  expiresAt: string;
  newSessionExpiresAt: string;
  mock: boolean;
  setup?: Record<string, unknown>;
}

export type LiveStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';
