import { describe, expect, it } from 'vitest';
import { cosineSimilarity, decodeVector, encodeVector, normalizeVector } from '../src/lib/vectors';
import { DEFAULT_CHUNKING } from '../src/modules/rag/chunking';
import { buildVectorStoreFile, VectorStore } from '../src/modules/rag/vectorStore';

describe('cosineSimilarity', () => {
  it('is 1 for the same direction, 0 for orthogonal and -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 5])).toBeCloseTo(0);
    expect(cosineSimilarity([1, -1], [-1, 1])).toBeCloseTo(-1);
  });

  it('matches the textbook formula', () => {
    // (1*4 + 2*5 + 3*6) / (|a| |b|) = 32 / (sqrt(14) * sqrt(77))
    expect(cosineSimilarity([1, 2, 3], [4, 5, 6])).toBeCloseTo(32 / Math.sqrt(14 * 77), 6);
  });

  it('returns 0 for a zero vector and rejects different lengths', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/lengths differ/);
  });
});

describe('vector helpers', () => {
  it('normalizes to unit length', () => {
    const vector = normalizeVector([3, 4]);
    expect(vector[0]).toBeCloseTo(0.6);
    expect(vector[1]).toBeCloseTo(0.8);
  });

  it('round-trips through base64', () => {
    const vector = Float32Array.from([0.25, -1.5, 3]);
    expect(Array.from(decodeVector(encodeVector(vector)))).toEqual([0.25, -1.5, 3]);
  });
});

describe('VectorStore.search', () => {
  const chunk = (id: string) => ({
    chunkId: id,
    schemeId: id,
    schemeName: id,
    section: 'Overview',
    sourceFile: `${id}.md`,
    text: id,
    tokens: 1,
  });
  const store = new VectorStore(
    buildVectorStoreFile(
      {
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        embedModel: 'test',
        dimensions: 2,
        sourceFingerprint: 'test',
        chunking: DEFAULT_CHUNKING,
        documents: [],
      },
      [chunk('east'), chunk('north'), chunk('north-east')],
      [
        [1, 0],
        [0, 1],
        [Math.SQRT1_2, Math.SQRT1_2],
      ].map((values) => Float32Array.from(values)),
    ),
  );

  it('returns the topK most similar chunks, best first, with scores', () => {
    const results = store.search(Float32Array.from([0.9, 0.1]), 2);
    expect(results.map((result) => result.chunkId)).toEqual(['east', 'north-east']);
    expect(results[0].score).toBeGreaterThan(results[1].score);
    expect(results[0]).not.toHaveProperty('tokens');
  });
});
