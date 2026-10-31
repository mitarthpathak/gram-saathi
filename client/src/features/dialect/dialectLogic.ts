import type { QueryResponse } from '@gram-saathi/shared';

export type DialectPromptMode = 'high' | 'confirm' | null;

/** Which correction card is supported by the response shape? */
export function getDialectPromptMode(response: QueryResponse): DialectPromptMode {
  if (response.dialect?.confidence === 'high') return 'high';
  if (response.dialect?.confidence === 'medium') return 'confirm';
  if (response.dialect == null && (response.dialectCandidates?.length ?? 0) > 0) return 'confirm';
  return null;
}

export interface HintStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const DIALECT_HINT_KEY = 'gs:dialectHint';

export function readDialectHint(store: HintStore): string | null {
  return store.get(DIALECT_HINT_KEY);
}

export function writeDialectHint(store: HintStore, dialectId: string | null): void {
  if (dialectId) store.set(DIALECT_HINT_KEY, dialectId);
  else store.remove(DIALECT_HINT_KEY);
}
