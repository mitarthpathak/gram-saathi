import { describe, expect, it } from 'vitest';
import { recommendThreshold } from '../scripts/calibrate-rag';

describe('RAG threshold recommendation', () => {
  it('chooses the midpoint when scheme and non-scheme scores separate', () => {
    expect(recommendThreshold([0.72, 0.8], [0.1, 0.4])).toMatchObject({
      threshold: 0.56, separated: true, schemeMin: 0.72, nonSchemeMax: 0.4,
    });
  });

  it('still recommends a balanced threshold when groups overlap', () => {
    const result = recommendThreshold([0.3, 0.9], [0.2, 0.8]);
    expect(result.separated).toBe(false);
    expect(result.threshold).toBeGreaterThanOrEqual(0.2);
    expect(result.threshold).toBeLessThanOrEqual(0.9);
  });
});
