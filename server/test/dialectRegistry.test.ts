import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadDialectRegistry,
  STANDARD_DIALECT_LABELS,
  validateDialectRegistry,
} from '../src/modules/dialect/registry';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('dialect registry', () => {
  it('has unique ids, valid answer languages, and valid confusable references', () => {
    const registry = loadDialectRegistry();
    const ids = registry.map(({ id }) => id);
    const validIds = new Set([...ids, ...STANDARD_DIALECT_LABELS]);

    expect(new Set(ids).size).toBe(ids.length);
    expect(
      registry.every(({ parentLanguage }) => ['hi', 'mr', 'ta', 'en'].includes(parentLanguage)),
    ).toBe(true);
    expect(registry.every((entry) => entry.confusableWith.every((id) => validIds.has(id)))).toBe(
      true,
    );
  });

  it('rejects duplicate ids, unknown confusable labels, and unsupported parent languages', () => {
    const registry = loadDialectRegistry();
    expect(() => validateDialectRegistry([...registry, registry[0]])).toThrow(
      /Duplicate dialect id/,
    );

    const unknownReference = structuredClone(registry);
    unknownReference[0].confusableWith = ['not_a_label'];
    expect(() => validateDialectRegistry(unknownReference)).toThrow(/unknown confusableWith/);

    const unsupportedParent = structuredClone(registry);
    (unsupportedParent[0] as { parentLanguage: string }).parentLanguage = 'gu';
    expect(() => validateDialectRegistry(unsupportedParent)).toThrow();
  });

  it.each([
    ['mock', 'true'],
    ['real', 'false'],
  ])('serves GET /api/dialects in %s mode', async (_mode, useMocks) => {
    vi.stubEnv('USE_MOCKS', useMocks);
    vi.resetModules();
    const { createApp } = await import('../src/createApp.js');
    const server = createApp().listen(0);
    const { port } = server.address() as AddressInfo;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/dialects`);
      const body = (await response.json()) as { items: unknown[] };
      expect(response.status).toBe(200);
      expect(body.items).toHaveLength(14);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('keeps the USE_MOCKS=true voice query flow working and demonstrates all mock states', async () => {
    vi.stubEnv('USE_MOCKS', 'true');
    vi.resetModules();
    const { createApp } = await import('../src/createApp.js');
    const server = createApp().listen(0);
    const { port } = server.address() as AddressInfo;
    const baseUrl = 'http://127.0.0.1:' + port;

    try {
      const results = [];
      for (let turn = 0; turn < 3; turn += 1) {
        const form = new FormData();
        form.set(
          'audio',
          new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' }),
          'voice.wav',
        );
        form.set('language', 'hi');
        form.set('sessionId', 'mock-dialect-' + turn);
        const response = await fetch(baseUrl + '/api/voice/query', {
          method: 'POST',
          body: form,
        });
        results.push(
          (await response.json()) as {
            dialect: { confidence?: string } | null;
            dialectCandidates?: unknown[];
          },
        );
        expect(response.status).toBe(200);
      }

      expect(results[0].dialect?.confidence).toBe('high');
      expect(results[0].dialectCandidates).toBeUndefined();
      expect(results[1].dialect?.confidence).toBe('medium');
      expect(results[1].dialectCandidates?.length).toBeGreaterThan(0);
      expect(results[2].dialect).toBeNull();
      expect(results[2].dialectCandidates?.length).toBeGreaterThan(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
