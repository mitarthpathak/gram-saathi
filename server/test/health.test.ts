import { describe, expect, it } from 'vitest';
import { getHealthStatus } from '../src/modules/health/service';

describe('health status', () => {
  it('reports mock and optional feature configuration flags as booleans', () => {
    const result = getHealthStatus();
    expect(result.status).toBe('ok');
    expect(typeof result.mocks).toBe('boolean');
    expect(typeof result.dialectConfigured).toBe('boolean');
    expect(typeof result.ttsConfigured).toBe('boolean');
  });
});
