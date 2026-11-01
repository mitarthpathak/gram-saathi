import { describe, expect, it } from 'vitest';
import { MOCKABLE_MODULES, resolveMockSetting } from '../src/config/env';

describe('USE_MOCKS=auto (the default)', () => {
  it('serves mock data for every module when no Gemini key is set', () => {
    expect([...resolveMockSetting('auto', undefined)]).toEqual([...MOCKABLE_MODULES]);
    expect([...resolveMockSetting('auto', '  ')]).toEqual([...MOCKABLE_MODULES]);
  });

  it('runs the real pipeline when a Gemini key is set', () => {
    expect(resolveMockSetting('auto', 'a-key').size).toBe(0);
  });

  it('keeps explicit values exactly as before', () => {
    const all = new Set(MOCKABLE_MODULES);
    expect(resolveMockSetting(all, 'a-key')).toBe(all);
    const listed = new Set(['eligibility', 'sms'] as const);
    expect(resolveMockSetting(listed, 'a-key')).toBe(listed);
    const none = new Set<(typeof MOCKABLE_MODULES)[number]>();
    expect(resolveMockSetting(none, undefined)).toBe(none);
  });
});
