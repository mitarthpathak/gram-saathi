import { describe, expect, it } from 'vitest';
import { buildContributionExport, consentAllowsRecording, detectScript, type LocalContribution } from './contributionLogic';

const row: LocalContribution = {
  id: 'c1', label: 'wagdi', transcript: 'મારે સહાય જોઈએ', hindiMeaning: 'मुझे मदद चाहिए',
  script: 'other', district: 'Banswara', area: 'Bagidora', speakerAnonId: 'speaker-random',
  consent: true, codeSwitch: false, durationMs: 8000, audioBlob: new Blob(['audio'], { type: 'audio/webm' }),
  audioMime: 'audio/webm', createdAt: 1,
};

describe('contribution export and consent', () => {
  it('requires explicit consent before recording tools are enabled', () => {
    expect(consentAllowsRecording(false)).toBe(false);
    expect(consentAllowsRecording(true)).toBe(true);
  });

  it('emits exactly the merge script fields with consent true', () => {
    const result = buildContributionExport(row, 'YXVkaW8=');
    expect(Object.keys(result)).toEqual([
      'id', 'label', 'transcript', 'hindiMeaning', 'script', 'district', 'area',
      'speakerAnonId', 'consent', 'codeSwitch', 'durationMs', 'audioBase64', 'audioMime',
    ]);
    expect(result).toMatchObject({ id: 'c1', consent: true, audioBase64: 'YXVkaW8=', audioMime: 'audio/webm' });
  });

  it('detects Devanagari and Latin code switching', () => {
    expect(detectScript('मुझे help चाहिए')).toBe('mixed');
    expect(detectScript('मुझे मदद चाहिए')).toBe('devanagari');
    expect(detectScript('kem cho')).toBe('roman');
  });
});
