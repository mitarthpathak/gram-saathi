import { describe, expect, it } from 'vitest';
import {
  aggregateStatus,
  characterErrorRate,
  decodeDataUrl,
  parseWav,
  percentile,
  plausibleDuration,
  romanWords,
  sequentialDepth,
  silentWav,
  toCsv,
} from '../scripts/audit/checks';
import { buildMatrix, checkChanges, rowVerdict } from '../scripts/audit/report';
import type { AuditResults, StageResult } from '../scripts/audit/types';
import {
  describeFacts,
  englishNumberWords,
  extractFacts,
  hasFacts,
  missingFacts,
  normalizeDigits,
} from '../src/lib/facts';
import { getDialectRegistry } from '../src/modules/dialect/registry';

describe('fact extraction', () => {
  it('normalizes Devanagari, Tamil and Western digits and drops separators', () => {
    expect(normalizeDigits('₹६,००० और ௨௦௦௦')).toBe('₹6,000 और 2000');
    const western = extractFacts('₹6,000 per year');
    const devanagari = extractFacts('साल में ₹६,००० मिलते हैं');
    expect(devanagari).toEqual(western);
    expect(western.rupees).toEqual(['₹6000']);
    expect(western.numbers).toEqual(['6000']);
  });

  it('finds rupee amounts written after the number, URLs, domains and helplines', () => {
    const facts = extractFacts(
      'हर साल 6000 रुपये मिलते हैं। pmkisan.gov.in पर देखें या https://www.nrega.nic.in/ खोलें। हेल्पलाइन 1800-180-1551 या 14555',
    );
    expect(facts.rupees).toEqual(['₹6000']);
    expect(facts.urls).toEqual(['nrega.nic.in', 'pmkisan.gov.in']);
    expect(facts.phones).toEqual(['18001801551']);
    expect(facts.numbers).toEqual(['14555', '6000']);
  });

  it('reports facts missing from a passage, accepting English number words there', () => {
    const answer = extractFacts('₹6,000 साल में, 3 किस्तों में ₹2,000');
    const passage = extractFacts('₹6,000 per year in three equal instalments');
    const supported = {
      ...passage,
      numbers: [...passage.numbers, ...englishNumberWords('three equal instalments')],
    };
    const missing = missingFacts(answer, supported);
    expect(missing.numbers).toEqual(['2000']);
    expect(missing.rupees).toEqual(['₹2000']);
    expect(hasFacts(missing)).toBe(true);
    expect(describeFacts(missing)).toBe('numbers 2000; rupees ₹2000');
  });

  it('has no facts in plain words', () => {
    expect(hasFacts(extractFacts('मैं आसान शब्दों में फिर से बताता हूँ।'))).toBe(false);
  });
});

describe('audit checks', () => {
  it('aggregates statuses honestly', () => {
    expect(aggregateStatus([])).toBe('NOT-TESTED');
    expect(aggregateStatus(['PASS', 'FAIL'])).toBe('FAIL');
    expect(aggregateStatus(['PASS', 'PASS'])).toBe('PASS');
    expect(aggregateStatus(['PASS', 'NOT-TESTED'])).toBe('PARTIAL');
    expect(aggregateStatus(['MOCK-ONLY', 'NOT-TESTED'])).toBe('NOT-TESTED');
    expect(aggregateStatus(['NEEDS-HUMAN', 'MOCK-ONLY'])).toBe('NEEDS-HUMAN');
  });

  it('computes nearest-rank percentiles', () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([5, 1, 3, 2, 4], 95)).toBe(5);
    expect(percentile([], 50)).toBeUndefined();
  });

  it('measures character error rate after normalization', () => {
    expect(characterErrorRate('पीएम किसान?', 'पीएम किसान')).toBe(0);
    expect(characterErrorRate('abcd', 'abed')).toBeCloseTo(0.25);
    expect(characterErrorRate('', '')).toBe(0);
  });

  it('flags Roman words in an Indic reply but allows acronyms, domains and scheme names', () => {
    expect(
      romanWords('पीएम-किसान में OTP और CSC, pmkisan.gov.in पर eKYC', ['PM-KISAN Samman Nidhi']),
    ).toEqual([]);
    expect(romanWords('Maaf kijiye, PM-KISAN ki jaankari', ['PM-KISAN Samman Nidhi'])).toEqual([
      'Maaf',
      'kijiye',
      'ki',
      'jaankari',
    ]);
  });

  it('reads WAV headers and durations', () => {
    const wav = silentWav(1500);
    const info = parseWav(wav);
    expect(info.valid).toBe(true);
    expect(info.sampleRate).toBe(16000);
    expect(info.durationSec).toBeCloseTo(1.5);
    expect(parseWav(Buffer.from('not a wav file at all')).valid).toBe(false);
  });

  it('judges duration plausibility and decodes data URLs', () => {
    expect(plausibleDuration('नमस्ते, आपका स्वागत है', 2).plausible).toBe(true);
    expect(
      plausibleDuration('a much longer sentence that cannot be spoken in a tenth of a second', 0.1)
        .plausible,
    ).toBe(false);
    const decoded = decodeDataUrl(`data:audio/wav;base64,${silentWav(100).toString('base64')}`);
    expect(decoded?.mimeType).toBe('audio/wav');
    expect(parseWav(decoded!.bytes).valid).toBe(true);
  });

  it('counts sequential calls, treating overlapping calls as parallel', () => {
    expect(sequentialDepth([])).toBe(0);
    expect(
      sequentialDepth([
        { startedAt: 0, durationMs: 10 },
        { startedAt: 10, durationMs: 10 },
        { startedAt: 12, durationMs: 10 },
        { startedAt: 30, durationMs: 10 },
      ]),
    ).toBe(3);
  });

  it('escapes CSV cells', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"']])).toBe('a,"b,c","say ""hi"""\n');
  });
});

describe('readiness matrix', () => {
  it('has a row per language and registry dialect and never passes untested cells', () => {
    const matrix = buildMatrix(
      [{ row: 'hi', column: 'answersInLanguage', status: 'MOCK-ONLY', evidence: 'mock' }],
      getDialectRegistry(),
    );
    expect(matrix).toHaveLength(4 + getDialectRegistry().length);
    const hindi = matrix.find((row) => row.row === 'hi')!;
    expect(hindi.cells.answersInLanguage.status).toBe('MOCK-ONLY');
    expect(hindi.cells.understandsSpeech.status).toBe('NOT-TESTED');
    expect(hindi.cells.ttsNamesLanguage.status).toBe('PASS');
    const braj = matrix.find((row) => row.row === 'braj')!;
    expect(braj.cells.ttsNamesLanguage.status).toBe('FAIL');
    expect(matrix.find((row) => row.row === 'bhojpuri')!.cells.ttsNamesLanguage.status).toBe(
      'PASS',
    );
    expect(rowVerdict(braj)).toContain('parent-language approximation');
  });
});

describe('before/after comparison', () => {
  const run = (checks: Array<[string, StageResult['status']]>): AuditResults => ({
    version: 1,
    generatedAt: '2026-10-31T00:00:00Z',
    git: { branch: 'b', commit: 'c', dirty: false },
    label: 'x',
    workers: [],
    matrix: [],
    sandboxNotes: [],
    stages: [
      {
        stage: 'I',
        name: 'Robustness',
        status: 'PARTIAL',
        mode: 'fake-backend',
        durationMs: 0,
        checks: checks.map(([id, status]) => ({
          id,
          title: `title ${id}`,
          status,
          detail: '',
          evidence: [],
        })),
      },
    ],
  });

  it('lists added, removed and changed checks', () => {
    const text = checkChanges(
      run([
        ['kept', 'PASS'],
        ['changed', 'NOT-TESTED'],
        ['gone', 'PASS'],
      ]),
      run([
        ['kept', 'PASS'],
        ['changed', 'PASS'],
        ['added', 'PASS'],
      ]),
    );
    expect(text).toContain('| changed | NOT-TESTED | PASS |');
    expect(text).toContain('| added | (new) | PASS |');
    expect(text).toContain('| gone | PASS | (removed) |');
    expect(text).not.toContain('| kept |');
  });
});
