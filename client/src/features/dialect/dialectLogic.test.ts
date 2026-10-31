import type { DialectOption, QueryResponse } from '@gram-saathi/shared';
import { describe, expect, it } from 'vitest';
import {
  DIALECT_HINT_KEY,
  getDialectPromptMode,
  readDialectHint,
  writeDialectHint,
  type HintStore,
} from './dialectLogic';

const option: DialectOption = { id: 'wagdi', name: 'Wagdi', nativeName: 'વાગડી' };

function response(overrides: Partial<QueryResponse> = {}): QueryResponse {
  return {
    sessionId: 'test',
    detectedLanguage: 'hi',
    answer: 'Answer',
    sources: [],
    fraudWarning: 'Warning',
    smsText: 'Answer',
    smsSegments: 1,
    audioUrl: null,
    usedCache: false,
    notFound: false,
    ...overrides,
  };
}

describe('getDialectPromptMode', () => {
  it('shows the high confidence chip', () => {
    expect(getDialectPromptMode(response({ dialect: { ...option, confidence: 'high' } }))).toBe(
      'high',
    );
  });

  it('asks for confirmation for medium confidence', () => {
    expect(
      getDialectPromptMode(
        response({
          dialect: { ...option, confidence: 'medium' },
          dialectCandidates: [option],
        }),
      ),
    ).toBe('confirm');
  });

  it('asks for confirmation when detection abstains with candidates', () => {
    expect(getDialectPromptMode(response({ dialect: null, dialectCandidates: [option] }))).toBe(
      'confirm',
    );
  });

  it('shows nothing for abstention without candidates', () => {
    expect(getDialectPromptMode(response({ dialect: null, dialectCandidates: [] }))).toBeNull();
  });
});

describe('dialect hint persistence', () => {
  it('stores a selected dialect and clears it back to auto-detect', () => {
    const values = new Map<string, string>();
    const store: HintStore = {
      get: (key) => values.get(key) ?? null,
      set: (key, value) => void values.set(key, value),
      remove: (key) => void values.delete(key),
    };

    writeDialectHint(store, 'wagdi');
    expect(readDialectHint(store)).toBe('wagdi');
    expect(values.get(DIALECT_HINT_KEY)).toBe('wagdi');

    writeDialectHint(store, null);
    expect(readDialectHint(store)).toBeNull();
    expect(values.has(DIALECT_HINT_KEY)).toBe(false);
  });
});
