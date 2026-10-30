import { afterEach, describe, expect, it } from 'vitest';
import { setGeminiBackend } from '../src/lib/geminiClient';
import {
  classifyDialect,
  decideDialect,
  getActiveDialectLabels,
  type DialectDecisionInput,
} from '../src/modules/dialect/classifier';
import {
  answerLanguageFromTranscription,
  dialectHintOutcome,
  parentLanguageForDialect,
} from '../src/modules/dialect/language';
import { getDialectRegistry, STANDARD_DIALECT_LABELS } from '../src/modules/dialect/registry';
import { transcribe } from '../src/modules/voice/service';
import { fakeGemini } from './fakeGemini';
import { mockDialectFields } from '../src/mocks/dialects';

const DIALECTS = getDialectRegistry();
const ALL_LABELS = [...DIALECTS.map(({ id }) => id), ...STANDARD_DIALECT_LABELS];
const optionIds = (result: { dialectCandidates?: { id: string }[] }) =>
  result.dialectCandidates?.map(({ id }) => id);

afterEach(() => setGeminiBackend(undefined));

describe('decideDialect', () => {
  const cases: {
    name: string;
    votes: string[];
    minimumVotes?: number;
    ensembleSize?: number;
    activeLabels?: string[];
    dialect?: string | null;
    confidence?: 'medium' | 'high';
    candidates: string[];
  }[] = [
    {
      name: 'unanimous dialect is high confidence',
      votes: ['braj', 'braj', 'braj'],
      dialect: 'braj',
      confidence: 'high',
      candidates: [],
    },
    {
      name: 'two of three dialect votes are medium confidence',
      votes: ['braj', 'braj', 'marwari'],
      dialect: 'braj',
      confidence: 'medium',
      candidates: ['braj', 'marwari'],
    },
    {
      name: 'medium candidates are ranked by dialect vote count',
      votes: ['marwari', 'marwari', 'braj', 'bundeli', 'hindi'],
      ensembleSize: 5,
      dialect: 'marwari',
      confidence: 'medium',
      candidates: ['marwari', 'braj', 'bundeli'],
    },
    {
      name: 'plain Hindi returns voted dialect candidates',
      votes: ['hindi', 'hindi', 'braj'],
      dialect: null,
      candidates: ['braj'],
    },
    {
      name: 'plain Marathi returns no dialect when none received a vote',
      votes: ['marathi', 'marathi', 'marathi'],
      dialect: null,
      candidates: [],
    },
    {
      name: 'plain Tamil keeps dialect votes as suggestions',
      votes: ['tamil', 'tamil', 'wagdi'],
      dialect: null,
      candidates: ['wagdi'],
    },
    {
      name: 'English returns dialects that received votes',
      votes: ['english', 'english', 'haryanvi'],
      dialect: null,
      candidates: ['haryanvi'],
    },
    {
      name: 'Gujarati vote suggests Wagdi from confusableWith',
      votes: ['gujarati', 'gujarati', 'gujarati'],
      dialect: null,
      candidates: ['wagdi'],
    },
    {
      name: 'Punjabi vote suggests Bagri and Haryanvi',
      votes: ['punjabi', 'punjabi', 'punjabi'],
      dialect: null,
      candidates: ['bagri', 'haryanvi'],
    },
    {
      name: 'other language vote suggests Wagdi',
      votes: ['other_language', 'other_language', 'other_language'],
      dialect: null,
      candidates: ['wagdi'],
    },
    {
      name: 'no label reaches minimum votes and voted dialects are offered',
      votes: ['braj', 'marwari', 'hindi'],
      dialect: null,
      candidates: ['braj', 'marwari'],
    },
    {
      name: 'mixed or uncertain abstains even when it wins',
      votes: ['mixed_or_uncertain', 'mixed_or_uncertain', 'braj'],
      dialect: null,
      candidates: ['braj'],
    },
    {
      name: 'a tie at the top abstains with both dialect candidates',
      votes: ['braj', 'braj', 'marwari', 'marwari'],
      ensembleSize: 4,
      dialect: null,
      candidates: ['braj', 'marwari'],
    },
    {
      name: 'votes outside the closed active set are discarded',
      votes: ['invented_label', 'invented_label', 'invented_label'],
      dialect: null,
      candidates: [],
    },
    {
      name: 'inactive dialect votes cannot produce a result',
      votes: ['braj', 'braj', 'braj'],
      activeLabels: ['hindi', 'mixed_or_uncertain'],
      dialect: null,
      candidates: [],
    },
    {
      name: 'unsupported class with no active confusable dialect abstains',
      votes: ['punjabi', 'punjabi', 'punjabi'],
      activeLabels: ['braj', 'punjabi', 'mixed_or_uncertain'],
      dialect: null,
      candidates: [],
    },
    {
      name: 'empty votes abstain without suggestions',
      votes: [],
      dialect: null,
      candidates: [],
    },
  ];

  it.each(cases)('$name', (testCase) => {
    const input: DialectDecisionInput = {
      votes: testCase.votes,
      activeLabels: testCase.activeLabels ?? ALL_LABELS,
      minimumVotes: testCase.minimumVotes ?? 2,
      ensembleSize: testCase.ensembleSize ?? 3,
      dialects: DIALECTS,
    };
    const result = decideDialect(input);
    expect(result.dialect?.id ?? null).toBe(testCase.dialect);
    if (testCase.confidence) expect(result.dialect?.confidence).toBe(testCase.confidence);
    expect(optionIds(result) ?? []).toEqual(testCase.candidates);
  });
});

describe('dialect language mapping and hints', () => {
  it('maps every current dialect to its parent answer language', () => {
    for (const entry of DIALECTS) {
      expect(parentLanguageForDialect(entry.id)).toBe(entry.parentLanguage);
    }
  });

  it('lets a confirmed dialect override unsupported-language and selected-language hints', () => {
    expect(answerLanguageFromTranscription('gujarati', 'mr', 'wagdi')).toBe('hi');
    expect(dialectHintOutcome('braj')).toMatchObject({
      dialect: { id: 'braj', confidence: 'high' },
      dialectCandidates: [],
    });
  });

  it('falls back from unsupported languages to the selected language, then Hindi', () => {
    expect(answerLanguageFromTranscription('gujarati', 'mr')).toBe('mr');
    expect(answerLanguageFromTranscription('punjabi')).toBe('hi');
    expect(answerLanguageFromTranscription('other_language')).toBe('hi');
  });

  it('keeps standard supported transcription language codes', () => {
    expect(answerLanguageFromTranscription('ta')).toBe('ta');
    expect(answerLanguageFromTranscription('English')).toBe('en');
  });
});

describe('mock dialect response shapes', () => {
  it('cycles through confident, medium with candidates, and abstention responses', () => {
    const high = mockDialectFields();
    const medium = mockDialectFields();
    const abstention = mockDialectFields();

    expect(high.dialect?.confidence).toBe('high');
    expect(high.dialectCandidates).toBeUndefined();
    expect(medium.dialect?.confidence).toBe('medium');
    expect(medium.dialectCandidates?.length).toBeGreaterThan(0);
    expect(abstention.dialect).toBeNull();
    expect(abstention.dialectCandidates?.length).toBeGreaterThan(0);
  });
});

describe('classifyDialect Gemini ensemble', () => {
  it('runs audio, transcript, and combined evidence views independently in parallel', async () => {
    const fake = fakeGemini(() => ({ label: 'braj', reason: 'regional words in evidence' }));
    setGeminiBackend(fake);
    const result = await classifyDialect({
      audio: { data: 'AA==', mimeType: 'audio/wav' },
      text: 'dialect transcript fixture',
      activeLabels: ALL_LABELS,
    });

    expect(fake.calls).toHaveLength(3);
    expect(fake.calls.filter((call) => JSON.stringify(call.input).includes('AA=='))).toHaveLength(
      2,
    );
    expect(
      fake.calls.filter((call) =>
        JSON.stringify(call.input).includes('dialect transcript fixture'),
      ),
    ).toHaveLength(2);
    expect(result).toMatchObject({ dialect: { id: 'braj', confidence: 'high' } });
  });

  it('decides with two successful votes when one of three calls fails', async () => {
    let call = 0;
    const fake = fakeGemini(() => {
      call += 1;
      if (call === 2) throw new Error('simulated classifier error');
      return { label: 'braj', reason: 'evidence' };
    });
    setGeminiBackend(fake);
    const result = await classifyDialect({
      audio: { data: 'AA==', mimeType: 'audio/wav' },
      text: 'dialect transcript fixture',
      activeLabels: ALL_LABELS,
      timeoutMs: 100,
    });

    expect(result).toMatchObject({ dialect: { id: 'braj', confidence: 'medium' } });
    expect(optionIds(result)).toEqual(['braj']);
  });

  it('returns an empty abstention after all views time out', async () => {
    setGeminiBackend({
      async generate() {
        return new Promise(() => undefined);
      },
      async embed() {
        return [];
      },
    });
    const result = await classifyDialect({
      audio: { data: 'AA==', mimeType: 'audio/wav' },
      text: 'dialect transcript fixture',
      activeLabels: ALL_LABELS,
      timeoutMs: 10,
    });
    expect(result).toEqual({ dialect: null, dialectCandidates: [] });
  });

  it('uses one transcript-only view for text detection and enforces the active enum', async () => {
    const fake = fakeGemini(() => ({ label: 'marathi', reason: 'language markers' }));
    setGeminiBackend(fake);
    await classifyDialect({
      text: 'काय योजना आहे?',
      activeLabels: ['braj', 'marathi', 'mixed_or_uncertain'],
      ensembleSize: 3,
      minimumVotes: 1,
    });

    expect(fake.calls).toHaveLength(1);
    expect(JSON.stringify(fake.calls[0].input)).not.toContain('type":"audio');
    expect(JSON.stringify(fake.calls[0].jsonSchema)).toContain('braj');
    expect(JSON.stringify(fake.calls[0].jsonSchema)).not.toContain('marwari');
  });

  it('loads the default active dialect label set', () => {
    expect(getActiveDialectLabels()).toEqual(ALL_LABELS);
  });

  it('keeps standard classes while narrowing active dialect ids', () => {
    expect(getActiveDialectLabels('braj,wagdi')).toEqual([
      'braj',
      'wagdi',
      ...STANDARD_DIALECT_LABELS,
    ]);
    expect(() => getActiveDialectLabels('unknown_id')).toThrow(/Unknown DIALECT_ACTIVE/);
  });
});

describe('verbatim transcription', () => {
  it('returns dialect transcript text without trimming or normalizing it', async () => {
    const transcript = '  dialect transcript fixture  ';
    setGeminiBackend(
      fakeGemini(() => ({ transcript, detectedLanguage: 'hi', script: 'Devanagari' })),
    );
    const result = await transcribe({
      audio: Buffer.from('audio'),
      mimeType: 'audio/webm',
      language: 'hi',
    });
    expect(result).toEqual({ transcript, detectedLanguage: 'hi', script: 'Devanagari' });
  });
});
