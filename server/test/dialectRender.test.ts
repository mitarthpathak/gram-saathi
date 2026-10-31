import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { env } from '../src/config/env';
import { checkFactsLock, schemeMentions } from '../src/lib/facts';
import { setGeminiBackend, type GenerateRequest } from '../src/lib/geminiClient';
import { clearConversationHistory, recordTurn } from '../src/modules/chat/conversation';
import {
  decideReplyDialect,
  renderInDialect,
  TONE_RULES,
  type DialectTarget,
  type RenderDeps,
  type RenderOptions,
} from '../src/modules/chat/dialectRender';
import { ASK_AGAIN } from '../src/modules/chat/messages';
import { answerQuestion, clearAnswerCache } from '../src/modules/chat/service';
import { getDialectRenderConfig } from '../src/modules/dialect/renderConfig';
import { renderPromptExemplars, type DialectExemplar } from '../src/modules/dialect/exemplars';
import { getDialectRegistry } from '../src/modules/dialect/registry';
import { DEFAULT_CHUNKING, type DocumentChunk } from '../src/modules/rag/chunking';
import { setKnowledgeBase } from '../src/modules/rag/service';
import { buildVectorStoreFile, VectorStore } from '../src/modules/rag/vectorStore';
import { embedTexts } from '../src/lib/geminiClient';
import { fakeGemini, topicVector } from './fakeGemini';

// Test texts are plain standard Hindi. Rewrites below are NOT dialect text: they only vary the
// facts or the script, because the facts lock and the plumbing are what these tests check.
const STANDARD = 'पीएम-किसान में हर साल ₹6,000 मिलते हैं। ज़्यादा जानकारी pmkisan.gov.in पर देखें।';
const SAME_FACTS = 'पीएम-किसान में हर साल ₹६,००० मिलते हैं। जानकारी pmkisan.gov.in पर देखें।';

const braj: DialectTarget = { id: 'braj', name: 'Braj', nativeName: 'ब्रज', parentLanguage: 'hi' };
const options = (overrides: Partial<RenderOptions> = {}): RenderOptions => ({
  mode: 'best_effort',
  verified: false,
  exemplars: [],
  timeoutMs: 1000,
  ...overrides,
});
const replying = (text: string, seen?: { system: string; prompt: string }[]): RenderDeps => ({
  generateJson: async <T>({ system, prompt }: { system: string; prompt: string }) => {
    seen?.push({ system, prompt });
    return { text } as T;
  },
});

describe('facts lock', () => {
  it('accepts the same facts written with Devanagari or Tamil digits', () => {
    expect(checkFactsLock(STANDARD, SAME_FACTS).ok).toBe(true);
    expect(checkFactsLock('₹6,000 हर साल', '₹௬,௦௦௦ हर साल').ok).toBe(true);
  });

  const NO_URL = 'पीएम-किसान में हर साल ₹6,000 मिलते हैं।';
  it.each([
    [
      'a changed amount',
      STANDARD,
      'पीएम-किसान में हर साल ₹600 मिलते हैं। जानकारी pmkisan.gov.in पर देखें।',
    ],
    ['a dropped website', STANDARD, NO_URL],
    ['an added helpline', STANDARD, `${STANDARD} हेल्पलाइन 155-261 या 1800-115-526`],
    ['a dropped scheme name', NO_URL, 'इस योजना में हर साल ₹6,000 मिलते हैं।'],
    ['an added scheme name', STANDARD, `${STANDARD} आयुष्मान कार्ड भी बनवाएं।`],
  ])('rejects %s', (_label, original, rewrite) => {
    expect(checkFactsLock(original, rewrite).ok).toBe(false);
  });

  it('finds scheme names in Latin, Devanagari and Tamil spellings', () => {
    expect(schemeMentions('PM-KISAN and Ayushman')).toEqual(['ayushman-bharat-pmjay', 'pm-kisan']);
    expect(schemeMentions('पीएम किसानचे पैसे')).toEqual(['pm-kisan']);
    expect(schemeMentions('பிஎம் கிசானில் பதிவு')).toEqual(['pm-kisan']);
    expect(schemeMentions('किसान परिवार')).toEqual([]);
  });
});

describe('renderInDialect', () => {
  it('returns the rewrite when the facts lock passes', async () => {
    const result = await renderInDialect(STANDARD, braj, options(), replying(SAME_FACTS));
    expect(result).toMatchObject({ rendered: 'dialect', text: SAME_FACTS, zeroShot: true });
    expect(result.reason).toBeUndefined();
  });

  it('falls back with facts_check_failed when a fact changes', async () => {
    const result = await renderInDialect(
      STANDARD,
      braj,
      options(),
      replying('पीएम-किसान में हर साल ₹600 मिलते हैं। pmkisan.gov.in'),
    );
    expect(result).toMatchObject({
      rendered: 'standard',
      reason: 'facts_check_failed',
      text: STANDARD,
    });
  });

  it('does not call the model when rendering is off or the dialect is not verified', async () => {
    const seen: { system: string; prompt: string }[] = [];
    expect(
      await renderInDialect(STANDARD, braj, options({ mode: 'off' }), replying(SAME_FACTS, seen)),
    ).toMatchObject({ rendered: 'standard', reason: 'render_off' });
    expect(
      await renderInDialect(
        STANDARD,
        braj,
        options({ mode: 'verified_only' }),
        replying(SAME_FACTS, seen),
      ),
    ).toMatchObject({ rendered: 'standard', reason: 'not_verified' });
    expect(seen).toHaveLength(0);
    expect(
      await renderInDialect(
        STANDARD,
        braj,
        options({ mode: 'verified_only', verified: true }),
        replying(SAME_FACTS, seen),
      ),
    ).toMatchObject({ rendered: 'dialect' });
    expect(seen).toHaveLength(1);
  });

  it('falls back on timeout, on a model timeout error and on any other error', async () => {
    const never: RenderDeps = { generateJson: () => new Promise(() => undefined) };
    expect(await renderInDialect(STANDARD, braj, options({ timeoutMs: 20 }), never)).toMatchObject({
      rendered: 'standard',
      reason: 'timeout',
    });
    const modelTimeout: RenderDeps = {
      generateJson: async () => {
        throw Object.assign(new Error('slow'), { kind: 'timeout' });
      },
    };
    expect(await renderInDialect(STANDARD, braj, options(), modelTimeout)).toMatchObject({
      reason: 'timeout',
    });
    const failing: RenderDeps = {
      generateJson: async () => {
        throw new Error('boom');
      },
    };
    expect(await renderInDialect(STANDARD, braj, options(), failing)).toMatchObject({
      rendered: 'standard',
      reason: 'error',
      text: STANDARD,
    });
  });

  it('never accepts Roman-script output', async () => {
    const roman = await renderInDialect(
      STANDARD,
      braj,
      options(),
      replying('PM-KISAN mein har saal ₹6,000 milte hain. pmkisan.gov.in'),
    );
    expect(roman).toMatchObject({ rendered: 'standard', reason: 'error' });
    const mixed = await renderInDialect(STANDARD, braj, options(), replying(`${SAME_FACTS} bhai`));
    expect(mixed).toMatchObject({ rendered: 'standard', reason: 'error' });
  });

  it('puts every tone rule and only the given exemplars in the prompt', async () => {
    const seen: { system: string; prompt: string }[] = [];
    await renderInDialect(
      STANDARD,
      braj,
      options({
        exemplars: ['- braj [devanagari]: “<braj example>” → Hindi meaning: “<meaning>”'],
      }),
      replying(SAME_FACTS, seen),
    );
    const [{ system, prompt }] = seen;
    for (const rule of TONE_RULES) expect(system).toContain(rule);
    expect(system).toContain('Braj (ब्रज)');
    expect(system).toContain('<braj example>');
    expect(system).toContain('never the rude "tu"');
    expect(prompt).toContain(STANDARD);
  });
});

describe('dialect exemplars for rewording', () => {
  it("selects only the requested dialect's consented rows", () => {
    const row = (label: string): DialectExemplar => ({
      text: `<${label} placeholder>`,
      hindiMeaning: '<meaning>',
      script: 'devanagari',
      speakerAnonId: `${label}-1`,
      consent: true,
    });
    const set = new Map<string, DialectExemplar[]>([
      ['braj', [row('braj')]],
      ['bhojpuri', [row('bhojpuri')]],
    ]);
    const lines = renderPromptExemplars(['braj'], set, { perLabel: 4, tokenBudget: 1800 });
    expect(lines.join('\n')).toContain('<braj placeholder>');
    expect(lines.join('\n')).not.toContain('bhojpuri');
  });
});

describe('reply dialect policy', () => {
  it('applies a hint always, a high-confidence identification, and nothing else', () => {
    expect(decideReplyDialect('braj', { dialect: null })).toEqual({ dialectId: 'braj' });
    expect(decideReplyDialect(undefined, { dialect: { id: 'wagdi', confidence: 'high' } })).toEqual(
      { dialectId: 'wagdi' },
    );
    expect(
      decideReplyDialect(undefined, { dialect: { id: 'wagdi', confidence: 'medium' } }),
    ).toEqual({ dialectId: null, reason: 'low_confidence' });
    expect(
      decideReplyDialect(undefined, { dialect: null, dialectCandidates: [{ id: 'braj' }] }),
    ).toEqual({ dialectId: null, reason: 'low_confidence' });
    expect(decideReplyDialect(undefined, { dialect: null, dialectCandidates: [] })).toEqual({
      dialectId: null,
      reason: 'no_dialect',
    });
  });

  it('has a render entry for every registry dialect, and none is verified by code', () => {
    const config = getDialectRenderConfig();
    expect(Object.keys(config).sort()).toEqual(
      getDialectRegistry()
        .map((entry) => entry.id)
        .sort(),
    );
    expect(Object.values(config).every((entry) => entry.verified === false)).toBe(true);
    expect(config.bhojpuri.ttsNamedLanguage).toBe(true);
    expect(config.braj.ttsNamedLanguage).toBe(false);
  });
});

describe('answerQuestion with dialect replies (fake Gemini)', () => {
  const chunk: DocumentChunk = {
    chunkId: 'pm-kisan:benefits:0',
    schemeId: 'pm-kisan',
    schemeName: 'PM-KISAN',
    section: 'Benefits',
    sourceFile: 'pm-kisan.md',
    text: 'PM-KISAN pays ₹6,000 each year. Details: pmkisan.gov.in',
    tokens: 12,
  };
  let rewrite = SAME_FACTS;
  let clarifyReply = 'मैं आसान शब्दों में फिर से बताता हूँ।';
  let calls: GenerateRequest[] = [];
  const savedMode = env.DIALECT_REPLY;

  beforeEach(async () => {
    clearAnswerCache();
    clearConversationHistory();
    rewrite = SAME_FACTS;
    clarifyReply = 'मैं आसान शब्दों में फिर से बताता हूँ।';
    setGeminiBackend(fakeGemini(() => null, topicVector));
    const vectors = await embedTexts([chunk.text], {
      kind: 'document',
      model: 'fake-embed',
      dimensions: 3,
    });
    setKnowledgeBase(
      new VectorStore(
        buildVectorStoreFile(
          {
            version: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            embedModel: 'fake-embed',
            dimensions: 3,
            sourceFingerprint: 'test',
            chunking: DEFAULT_CHUNKING,
            documents: [],
          },
          [chunk],
          vectors,
        ),
      ),
    );
    const fake = fakeGemini((request) => {
      if (request.system?.includes('You are the front door')) {
        const message = String(request.input).split('Latest user message:\n').at(-1)?.trim() ?? '';
        if (message === 'ki keh raho he') {
          return {
            intent: 'clarify',
            language: 'hi',
            dialect: 'some-model-guess',
            searchQueryEn: '',
            reply: clarifyReply,
          };
        }
        return {
          intent: 'scheme_question',
          language: 'hi',
          dialect: 'some-model-guess',
          searchQueryEn: 'PM-KISAN yearly amount',
          reply: '',
        };
      }
      if (request.system?.startsWith('You answer a question')) {
        const id = /\[([^\]]+)\]/.exec(String(request.input))?.[1];
        return { answersQuestion: true, answer: STANDARD, usedChunkIds: id ? [id] : [] };
      }
      if (request.system?.startsWith('You reword a short answer')) return { text: rewrite };
      return { sms: 'पीएम-किसान: हर साल ₹6,000।' };
    }, topicVector);
    calls = fake.calls;
    setGeminiBackend(fake);
  });

  afterEach(() => {
    (env as { DIALECT_REPLY: string }).DIALECT_REPLY = savedMode;
  });

  const ask = (
    dialectHint?: string,
    text = 'पीएम किसान में कितना पैसा मिलता है?',
    sessionId = 'dialect',
  ) => answerQuestion({ text, language: 'hi', dialectHint, sessionId });
  const renderCalls = () =>
    calls.filter((call) => call.system?.startsWith('You reword a short answer'));

  it('rewords a grounded answer for a confirmed dialect and says so', async () => {
    const response = await ask('braj');
    expect(response.answer).toBe(SAME_FACTS);
    expect(response.answerStyle).toEqual({
      language: 'hi',
      dialectId: 'braj',
      rendered: 'dialect',
    });
    expect(response.sources).toHaveLength(1);
    expect(renderCalls()).toHaveLength(1);
    expect(renderCalls()[0].system).toContain('Braj (ब्रज)');
    expect(renderCalls()[0].system).not.toContain('Bhojpuri');
    // The grounded answer itself was written without any dialect instruction.
    expect(
      calls.find((call) => call.system?.startsWith('You answer a question'))?.system,
    ).not.toContain('braj');
  });

  it('keeps the standard answer when the rewrite changes a fact', async () => {
    rewrite = 'पीएम-किसान में हर साल ₹6,500 मिलते हैं। जानकारी pmkisan.gov.in पर देखें।';
    const response = await ask('braj');
    expect(response.answer).toBe(STANDARD);
    expect(response.answerStyle).toMatchObject({
      dialectId: 'braj',
      rendered: 'standard',
      reason: 'facts_check_failed',
    });
  });

  it('does not reword typed text without a hint, even if the model guessed a dialect', async () => {
    const response = await ask(undefined);
    expect(response.answer).toBe(STANDARD);
    expect(response.answerStyle).toEqual({
      language: 'hi',
      dialectId: null,
      rendered: 'standard',
      reason: 'no_dialect',
    });
    expect(renderCalls()).toHaveLength(0);
  });

  it('respects DIALECT_REPLY=off and verified_only', async () => {
    (env as { DIALECT_REPLY: string }).DIALECT_REPLY = 'off';
    expect((await ask('braj')).answerStyle).toMatchObject({
      rendered: 'standard',
      reason: 'render_off',
    });
    (env as { DIALECT_REPLY: string }).DIALECT_REPLY = 'verified_only';
    expect((await ask('braj', 'पीएम किसान का पैसा?', 'v2')).answerStyle).toMatchObject({
      rendered: 'standard',
      reason: 'not_verified',
    });
    expect(renderCalls()).toHaveLength(0);
  });

  it('lets a clarification repeat known facts but never add new ones', async () => {
    recordTurn('clarify', 'पीएम किसान?', STANDARD);
    clarifyReply = 'आसान शब्दों में: पीएम-किसान में हर साल ₹6,000 मिलते हैं।';
    const repeated = await ask(undefined, 'ki keh raho he', 'clarify');
    expect(repeated.answer).toBe(clarifyReply);
    expect(repeated.sources).toEqual([]);

    clearConversationHistory();
    clarifyReply = 'पीएम-किसान में हर साल ₹12,000 मिलते हैं।';
    const invented = await ask(undefined, 'ki keh raho he', 'fresh');
    expect(invented.answer).toBe(ASK_AGAIN.hi);
    expect(invented.sources).toEqual([]);
    expect(invented.intent).toBe('clarify');
  });

  it('accepts the rewording schema shape', () => {
    expect(z.object({ text: z.string() }).safeParse({ text: 'x' }).success).toBe(true);
  });
});
