import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { setGeminiBackend } from '../src/lib/geminiClient';
import { chooseCalibration, resolveDialectSettings } from '../src/modules/dialect/calibration';
import { assignSpeakerSplits, parseContributions } from '../src/modules/dialect/contributions';
import { buildClassifierPrompt, classifyDialect } from '../src/modules/dialect/classifier';
import {
  assertSpeakerDisjoint,
  computeDialectMetrics,
  DiskEvalCache,
  parseDialectEvalRows,
  registryConfusablePairs,
  type DialectPrediction,
} from '../src/modules/dialect/evaluation';
import {
  estimatePromptTokenUnits,
  loadDialectExemplars,
  renderPromptExemplars,
  type DialectExemplar,
} from '../src/modules/dialect/exemplars';
import { getDialectRegistry } from '../src/modules/dialect/registry';
import { fakeGemini } from './fakeGemini';

const temporaryDirectories: string[] = [];

afterEach(() => {
  setGeminiBackend(undefined);
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function tempDirectory(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'gram-saathi-dialect-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe('native exemplar loader and prompt assembly', () => {
  it('loads empty and valid JSONL files, and rejects rows without consent', () => {
    const directory = tempDirectory();
    writeFileSync(path.join(directory, 'braj.jsonl'), '');
    expect(loadDialectExemplars(directory).get('braj')).toEqual([]);
    writeFileSync(
      path.join(directory, 'braj.jsonl'),
      JSON.stringify({
        text: 'fixture transcript A',
        hindiMeaning: 'fixture meaning A',
        script: 'devanagari',
        speakerAnonId: 'speaker-a',
        consent: true,
      }) + '\n',
    );
    expect(loadDialectExemplars(directory).get('braj')).toHaveLength(1);
    writeFileSync(
      path.join(directory, 'braj.jsonl'),
      JSON.stringify({
        text: 'fixture transcript A',
        hindiMeaning: 'fixture meaning A',
        script: 'devanagari',
        speakerAnonId: 'speaker-a',
        consent: false,
      }),
    );
    expect(() => loadDialectExemplars(directory)).toThrow(/consent/);
  });

  it('renders hard-negative pairs deterministically within the token budget', () => {
    const example = (speakerAnonId: string, text: string): DialectExemplar => ({
      text,
      hindiMeaning: 'meaning placeholder',
      script: 'devanagari',
      speakerAnonId,
      consent: true,
    });
    const examples = new Map<string, DialectExemplar[]>([
      ['braj', [example('b1', 'fixture-braj-token')]],
      ['hindi', [example('h1', 'fixture-hindi-token')]],
    ]);
    const labels = ['braj', 'hindi'];
    const first = renderPromptExemplars(labels, examples, { perLabel: 4, tokenBudget: 500 });
    const second = renderPromptExemplars(labels, new Map([...examples].reverse()), {
      perLabel: 4,
      tokenBudget: 500,
    });
    expect(first).toEqual(second);
    expect(first.join('\n')).toContain('Confusable pair braj / hindi');
    expect(estimatePromptTokenUnits(first.join('\n'))).toBeLessThanOrEqual(500);
    expect(renderPromptExemplars(labels, examples, { tokenBudget: 1 })).toEqual([]);
  });

  it('does not inject more than the per-label example limit', () => {
    const examples = new Map<string, DialectExemplar[]>([
      [
        'marwari',
        Array.from({ length: 6 }, (_, index) => ({
          text: `fixture-token-${index}`,
          hindiMeaning: `meaning-${index}`,
          script: 'roman' as const,
          speakerAnonId: `speaker-${index}`,
          consent: true as const,
        })),
      ],
    ]);
    const promptRows = renderPromptExemplars(['marwari'], examples, {
      perLabel: 4,
      tokenBudget: 10_000,
    });
    expect(promptRows.filter((line) => line.startsWith('- marwari '))).toHaveLength(4);
  });

  it('keeps labels without native rows zero-shot', () => {
    const prompt = buildClassifierPrompt(['braj', 'hindi'], getDialectRegistry(), new Map());
    expect(prompt).toContain('No native-speaker exemplars are available');
    expect(prompt).toContain('mixed_or_uncertain');
  });
});

describe('dialect evaluation and calibration math', () => {
  const predictions: DialectPrediction[] = [
    {
      id: '1',
      goldLabel: 'braj',
      predictedLabel: 'braj',
      highConfidence: true,
      script: 'devanagari',
      wordCount: 5,
      kind: 'text',
      codeSwitch: false,
    },
    {
      id: '2',
      goldLabel: 'braj',
      predictedLabel: 'hindi',
      highConfidence: true,
      script: 'roman',
      wordCount: 2,
      kind: 'text',
      codeSwitch: true,
    },
    {
      id: '3',
      goldLabel: 'hindi',
      predictedLabel: null,
      highConfidence: false,
      script: 'devanagari',
      wordCount: 2,
      kind: 'audio',
      codeSwitch: false,
      durationMs: 3000,
    },
    {
      id: '4',
      goldLabel: 'hindi',
      predictedLabel: 'braj',
      highConfidence: true,
      script: 'other',
      wordCount: 2,
      kind: 'audio',
      codeSwitch: true,
      durationMs: 20_000,
    },
  ];

  it('computes class metrics, confusion, coverage, and high-confidence errors', () => {
    const metrics = computeDialectMetrics(predictions, [['braj', 'hindi']]);
    expect(metrics.perClass.braj).toMatchObject({
      support: 2,
      predicted: 2,
      precision: 0.5,
      recall: 0.5,
      f1: 0.5,
    });
    expect(metrics.answeredPrecision).toBeCloseTo(1 / 3);
    expect(metrics.coverage).toBe(0.75);
    expect(metrics.abstentionRate).toBe(0.25);
    expect(metrics.confusionMatrix.hindi!['<abstain>']).toBe(1);
    expect(metrics.wrongWithHighConfidence.map(({ id }) => id)).toEqual(['2', '4']);
    expect(metrics.breakdowns.audioDuration['<5s']?.rows).toBe(1);
    expect(metrics.confusablePairs['braj vs hindi']?.accuracy).toBe(0.25);
    expect(registryConfusablePairs()).toContainEqual(['gujarati', 'wagdi']);
  });

  it('fails the run when a speaker appears in both data splits', () => {
    expect(() =>
      assertSpeakerDisjoint(
        [{ speakerAnonId: 'speaker-shared' }],
        new Map([['braj', [{ speakerAnonId: 'speaker-shared' }]]]),
      ),
    ).toThrow(/speaker-shared/);
  });

  it('chooses highest coverage that meets the target precision', () => {
    const scores = [
      { ensembleSize: 1, minimumVotes: 1, coverage: 1, answeredPrecision: 0.84, macroF1: 0.8 },
      { ensembleSize: 2, minimumVotes: 2, coverage: 0.68, answeredPrecision: 0.92, macroF1: 0.86 },
      { ensembleSize: 3, minimumVotes: 3, coverage: 0.48, answeredPrecision: 0.98, macroF1: 0.8 },
    ];
    expect(chooseCalibration(scores, 0.9)).toMatchObject({ ensembleSize: 2, minimumVotes: 2 });
    expect(chooseCalibration(scores, 0.99)).toBeUndefined();
  });

  it('uses calibration unless an env value explicitly overrides that setting', () => {
    const defaults = { ensembleSize: 3, minimumVotes: 2 };
    const saved = { ensembleSize: 2, minimumVotes: 1 };
    expect(
      resolveDialectSettings(defaults, saved, { ensembleSize: false, minimumVotes: false }),
    ).toEqual(saved);
    expect(
      resolveDialectSettings(defaults, saved, { ensembleSize: true, minimumVotes: false }),
    ).toEqual({
      ensembleSize: 3,
      minimumVotes: 1,
    });
    expect(
      resolveDialectSettings(defaults, undefined, { ensembleSize: false, minimumVotes: false }),
    ).toEqual(defaults);
  });

  it('serves repeated runs from the on-disk cache', async () => {
    const directory = tempDirectory();
    const cacheFile = path.join(directory, 'cache.json');
    let calls = 0;
    const first = new DiskEvalCache(cacheFile);
    expect(await first.getOrRun('row-key', async () => ({ prediction: ++calls }))).toEqual({
      value: { prediction: 1 },
      hit: false,
    });
    expect(readFileSync(cacheFile, 'utf8')).toContain('row-key');
    const second = new DiskEvalCache(cacheFile);
    expect(await second.getOrRun('row-key', async () => ({ prediction: ++calls }))).toEqual({
      value: { prediction: 1 },
      hit: true,
    });
    expect(calls).toBe(1);
  });

  it('runs a tiny held-out fixture through the fake backend and caches its measured prediction', async () => {
    const row = parseDialectEvalRows(
      JSON.stringify({
        id: 'fixture-1',
        kind: 'text',
        text: 'fixture transcript only',
        script: 'roman',
        label: 'braj',
        district: 'Mathura',
        speakerAnonId: 'held-out-speaker',
        consent: true,
        codeSwitch: false,
        hindiMeaning: 'fixture meaning only',
        annotatorConfidence: 'high',
        licence: 'fixture-only',
      }),
    )[0]!;
    const fake = fakeGemini(() => ({ label: 'braj', reason: 'fixture evidence' }));
    setGeminiBackend(fake);
    const cache = new DiskEvalCache(path.join(tempDirectory(), 'tiny-cache.json'));
    const run = async () => {
      let selectedLabel: string | null = null;
      const outcome = await classifyDialect({
        text: row.text,
        activeLabels: ['braj', 'hindi', 'mixed_or_uncertain'],
        ensembleSize: 1,
        minimumVotes: 1,
        onDecision: (trace) => (selectedLabel = trace.selectedLabel),
      });
      return { selectedLabel, highConfidence: outcome.dialect?.confidence === 'high' };
    };
    const first = await cache.getOrRun('fixture-key', run);
    const second = await cache.getOrRun('fixture-key', run);
    expect(first.value).toEqual({ selectedLabel: 'braj', highConfidence: true });
    expect(second.hit).toBe(true);
    expect(fake.calls).toHaveLength(1);
    expect(
      computeDialectMetrics([
        {
          id: row.id,
          goldLabel: row.label,
          predictedLabel: first.value.selectedLabel,
          highConfidence: first.value.highConfidence,
          script: row.script,
          wordCount: row.text!.trim().split(/\s+/u).length,
          kind: row.kind,
          codeSwitch: row.codeSwitch,
        },
      ]).answeredPrecision,
    ).toBe(1);
  });

  it('records unanimous standard-class votes as high confidence for the safety metric', async () => {
    setGeminiBackend(fakeGemini(() => ({ label: 'hindi', reason: 'fixture standard-class vote' })));
    let trace: { selectedLabel: string | null; confidence: 'medium' | 'high' | null } = {
      selectedLabel: null,
      confidence: null,
    };
    const outcome = await classifyDialect({
      text: 'fixture transcript only',
      activeLabels: ['braj', 'hindi', 'mixed_or_uncertain'],
      ensembleSize: 1,
      minimumVotes: 1,
      onDecision: (value) => (trace = value),
    });
    expect(outcome.dialect).toBeNull();
    expect(trace).toEqual({ votes: ['hindi'], selectedLabel: 'hindi', confidence: 'high' });
  });

  it('does not call a two-of-three plurality unanimous high confidence', async () => {
    let call = 0;
    setGeminiBackend(
      fakeGemini(() => {
        call++;
        return { label: call <= 2 ? 'braj' : 'hindi', reason: 'fixture vote' };
      }),
    );
    let trace: { selectedLabel: string | null; confidence: 'medium' | 'high' | null } = {
      selectedLabel: null,
      confidence: null,
    };
    const outcome = await classifyDialect({
      audio: { data: 'AA==', mimeType: 'audio/wav' },
      text: 'fixture transcript only',
      activeLabels: ['braj', 'hindi', 'mixed_or_uncertain'],
      ensembleSize: 3,
      minimumVotes: 2,
      onDecision: (value) => (trace = value),
    });
    expect(outcome.dialect).toMatchObject({ id: 'braj', confidence: 'medium' });
    expect(trace.confidence).toBe('medium');
  });
});

describe('contributor consent and split', () => {
  const contribution = (id: string, label: string, speakerAnonId: string) => ({
    id,
    label,
    transcript: `verbatim ${id}`,
    hindiMeaning: `meaning ${id}`,
    script: 'roman',
    district: 'Mathura',
    speakerAnonId,
    consent: true,
    codeSwitch: false,
    durationMs: 1200,
  });

  it('rejects a contribution unless consent is explicitly true', () => {
    expect(() =>
      parseContributions([{ ...contribution('x', 'braj', 's1'), consent: false }]),
    ).toThrow(/consent must be true/);
  });

  it('assigns whole speakers deterministically and balances labels with two speakers', () => {
    const rows = [
      contribution('1', 'braj', 'speaker-one'),
      contribution('2', 'braj', 'speaker-two'),
      contribution('3', 'hindi', 'speaker-one'),
      contribution('4', 'hindi', 'speaker-two'),
    ];
    const splitA = assignSpeakerSplits(rows);
    const splitB = assignSpeakerSplits([...rows].reverse());
    expect(splitA).toEqual(splitB);
    expect(splitA.get('speaker-one')).not.toBe(splitA.get('speaker-two'));
    expect(splitA.size).toBe(2);
  });
});
