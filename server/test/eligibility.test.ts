import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PATHS } from '../src/config/env';
import { setGeminiBackend } from '../src/lib/geminiClient';
import {
  matchOption,
  parseAnswer,
  parseNumberText,
  parseYesNo,
} from '../src/modules/eligibility/answers';
import {
  type Answers,
  evaluate,
  evaluateSchemes,
  failureReason,
  pendingQuestions,
} from '../src/modules/eligibility/engine';
import { clearTranslations } from '../src/modules/eligibility/localize';
import { PARSE_ANSWER_PROMPT } from '../src/modules/eligibility/prompts';
import {
  type Condition,
  type EligibilityRules,
  loadEligibilityRules,
  validateRules,
} from '../src/modules/eligibility/rules';
import { answerEligibility, loadRules, startEligibility } from '../src/modules/eligibility/service';
import { fakeGemini } from './fakeGemini';

const rules: EligibilityRules = loadEligibilityRules(PATHS.eligibility);
const question = (id: string) => rules.questions.find((q) => q.id === id)!;
const results = (answers: Answers) =>
  Object.fromEntries(
    evaluateSchemes(rules, answers, { en: 'default' }).map((o) => [o.scheme.schemeId, o.eligible]),
  );

afterEach(() => setGeminiBackend(undefined));

describe('rule files in data/eligibility', () => {
  it('load and validate', () => {
    expect(rules.schemes.length).toBeGreaterThanOrEqual(3);
    expect(rules.questions.map((q) => q.id)).toContain('age');
  });

  it('reject unknown questions, unknown options and comparisons that make no sense', () => {
    const scheme = rules.schemes[0];
    const withCondition = (eligibleIf: Condition) => ({
      questions: rules.questions,
      schemes: [{ ...scheme, eligibleIf }],
    });
    expect(() => validateRules(withCondition({ question: 'nope', op: '==', value: true }))).toThrow(
      /no such question/,
    );
    expect(() =>
      validateRules(withCondition({ question: 'occupation', op: 'in', value: ['pilot'] })),
    ).toThrow(/unknown option/);
    expect(() =>
      validateRules(withCondition({ question: 'hasBankAccount', op: '>', value: 1 })),
    ).toThrow(/"=="/);
  });
});

describe('three-valued evaluation', () => {
  const isAdult: Condition = { question: 'age', op: '>=', value: 18 };
  const hasLand: Condition = { question: 'landAcres', op: '>', value: 0 };

  it('is unknown until the answers decide it', () => {
    expect(evaluate({ all: [isAdult, hasLand] }, {})).toBeUndefined();
    expect(evaluate({ all: [isAdult, hasLand] }, { age: 10 })).toBe(false); // decided early
    expect(evaluate({ any: [isAdult, hasLand] }, { age: 30 })).toBe(true); // decided early
    expect(evaluate({ any: [isAdult, hasLand] }, { age: 10 })).toBeUndefined();
    expect(evaluate({ not: isAdult }, { age: 10 })).toBe(true);
    expect(evaluate({ question: 'age', op: 'between', value: [18, 40] }, { age: 40 })).toBe(true);
    expect(
      evaluate({ question: 'occupation', op: 'in', value: ['asha'] }, { occupation: 'farmer' }),
    ).toBe(false);
  });

  it('skips questions that can no longer change any result', () => {
    const asked = (answers: Answers) => pendingQuestions(rules, answers).map((q) => q.id);
    expect(asked({})[0]).toBe('age');
    // 75: PM-JAY is already yes and the age-limited schemes already no.
    expect(asked({ age: 75 })).not.toContain('occupation');
    expect(asked({ age: 75 })).not.toContain('hasBankAccount');
    // No land: PM-KISAN is decided, so the family income-tax question goes away.
    expect(asked({ age: 75, landAcres: 0 })).toEqual([]);
  });

  it('gives the same results for the same answers (sample rules)', () => {
    const farmer: Answers = {
      age: 35,
      occupation: 'farmer',
      landAcres: 2,
      paysIncomeTax: false,
      familyPaysIncomeTax: false,
      hasBankAccount: true,
    };
    expect(results(farmer)).toEqual({
      'pm-kisan': true,
      'atal-pension-yojana': true,
      'pm-suraksha-bima-yojana': true,
      'ayushman-bharat-pmjay': false,
    });
    expect(results({ ...farmer, age: 72, occupation: 'other' })).toMatchObject({
      'atal-pension-yojana': false,
      'pm-suraksha-bima-yojana': false,
      'ayushman-bharat-pmjay': true,
    });
    expect(results({ ...farmer, familyPaysIncomeTax: true })['pm-kisan']).toBe(false);
  });

  it('explains a "no" with the reason of the condition that failed', () => {
    const apy = rules.schemes.find((s) => s.schemeId === 'atal-pension-yojana')!;
    const reason = failureReason(apy.eligibleIf, {
      age: 30,
      paysIncomeTax: false,
      hasBankAccount: false,
    });
    expect(reason?.en).toMatch(/savings account/);
  });
});

describe('reading answers without AI', () => {
  it('understands yes / no words in four languages', () => {
    for (const yes of ['Yes', 'haan', 'हाँ', 'जी', 'होय', 'ஆம்'])
      expect(parseYesNo(yes)).toBe(true);
    for (const no of ['no', 'Nahi', 'नहीं', 'नाही', 'இல்லை']) expect(parseYesNo(no)).toBe(false);
    expect(parseYesNo('pata nahi')).toBeUndefined();
  });

  it('reads bare numbers in any script, with optional unit words', () => {
    expect(parseNumberText('35')).toBe(35);
    expect(parseNumberText('३५')).toBe(35);
    expect(parseNumberText('௩௫')).toBe(35);
    expect(parseNumberText('1,50,000')).toBe(150000);
    expect(parseNumberText('2.5 acres', ['acre', 'acres'])).toBe(2.5);
    expect(parseNumberText('2 bigha', ['acre', 'acres'])).toBeUndefined();
    expect(parseNumberText('do bigha')).toBeUndefined();
  });

  it('matches option labels in any language, ignoring case', () => {
    expect(matchOption(question('occupation'), 'किसान')).toBe('farmer');
    expect(matchOption(question('occupation'), 'FARMER')).toBe('farmer');
    expect(matchOption(question('occupation'), 'pilot')).toBeUndefined();
  });

  it('rejects wrong types and out-of-range numbers with 400 INVALID_ANSWER', async () => {
    await expect(parseAnswer(question('age'), 200, { freeForm: true })).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_ANSWER',
    });
    await expect(
      parseAnswer(question('hasBankAccount'), 1, { freeForm: true }),
    ).rejects.toMatchObject({ code: 'INVALID_ANSWER' });
    await expect(
      parseAnswer(question('hasBankAccount'), 'haan', { freeForm: false }),
    ).rejects.toMatchObject({ code: 'INVALID_ANSWER' });
  });
});

describe('reading free-form answers with Gemini', () => {
  it('turns "do bigha zameen" into acres, guided by the parse hint', async () => {
    const fake = fakeGemini(() => ({ value: 1.2, understood: true }));
    setGeminiBackend(fake);
    expect(
      await parseAnswer(question('landAcres'), 'do bigha zameen hai', { freeForm: true }),
    ).toBe(1.2);
    expect(fake.calls[0].system).toBe(PARSE_ANSWER_PROMPT);
    expect(String(fake.calls[0].input)).toMatch(/bigha/);
    expect(String(fake.calls[0].input)).toContain('ANSWER: do bigha zameen hai');
  });

  it('maps "main kisaan hu" to a choice option the rules know', async () => {
    const fake = fakeGemini(() => ({ value: 'farmer', understood: true }));
    setGeminiBackend(fake);
    expect(await parseAnswer(question('occupation'), 'main kisaan hu', { freeForm: true })).toBe(
      'farmer',
    );
    expect(fake.calls[0].jsonSchema).toMatchObject({
      properties: { value: { enum: ['farmer', 'labourer', 'asha', 'other'] } },
    });
  });

  it('answers 422 UNCLEAR_ANSWER when the model cannot read the answer', async () => {
    setGeminiBackend(fakeGemini(() => ({ value: false, understood: false })));
    await expect(
      parseAnswer(question('paysIncomeTax'), 'pata nahi bhai', { freeForm: true }),
    ).rejects.toMatchObject({
      status: 422,
      code: 'UNCLEAR_ANSWER',
    });
  });
});

describe('wizard sessions (USE_MOCKS=false)', () => {
  beforeEach(() => {
    loadRules();
    clearTranslations();
  });

  it('runs a Marathi session end to end with spoken-style answers', async () => {
    const response = await startEligibility({ sessionId: 'mr-1', language: 'mr' });
    expect(response.question).toMatchObject({
      id: 'age',
      type: 'number',
      text: 'तुमचे वय किती आहे? (वर्षांमध्ये)',
    });
    const answers: Record<string, string | number> = {
      age: '३२ वर्षे',
      occupation: 'शेतकरी',
      landAcres: 3,
      paysIncomeTax: 'नाही',
      familyPaysIncomeTax: 'नाही',
      hasBankAccount: 'होय',
    };
    let step = await answerEligibility({
      sessionId: 'mr-1',
      questionId: 'age',
      answer: answers.age,
    });
    while (!step.done) {
      expect(step.progress?.current).toBeLessThanOrEqual(step.progress?.total ?? 0);
      step = await answerEligibility({
        sessionId: 'mr-1',
        questionId: step.question.id,
        answer: answers[step.question.id],
      });
    }
    expect(step.results[0]).toMatchObject({ eligible: true });
    const kisan = step.results.find((r) => r.schemeId === 'pm-kisan')!;
    expect(kisan).toMatchObject({ eligible: true, schemeName: 'पीएम-किसान सन्मान निधी' });
    expect(step.results.at(-1)).toMatchObject({
      schemeId: 'ayushman-bharat-pmjay',
      eligible: false,
    });
    // The session ends with the results.
    await expect(
      answerEligibility({ sessionId: 'mr-1', questionId: 'age', answer: 30 }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('refuses an answer to another question (409) and keeps the session on a bad answer', async () => {
    await startEligibility({ sessionId: 's-2', language: 'en' });
    await expect(
      answerEligibility({ sessionId: 's-2', questionId: 'occupation', answer: 'Farmer' }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      answerEligibility({ sessionId: 's-2', questionId: 'age', answer: -5 }),
    ).rejects.toMatchObject({ status: 400 });
    const next = await answerEligibility({ sessionId: 's-2', questionId: 'age', answer: 30 });
    expect(next).toMatchObject({
      done: false,
      question: {
        id: 'occupation',
        options: ['Farmer', 'Daily-wage labourer', 'ASHA / Anganwadi worker', 'Other'],
      },
    });
  });

  it('machine-translates texts that have no reviewed translation, else shows English', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'rules-'));
    writeFileSync(
      path.join(dir, 'questions.json'),
      JSON.stringify({
        questions: [{ id: 'hasCow', type: 'boolean', text: { en: 'Do you have a cow?' } }],
      }),
    );
    writeFileSync(
      path.join(dir, 'cow-scheme.json'),
      JSON.stringify({
        schemeId: 'cow-scheme',
        verified: false,
        schemeName: { en: 'Cow scheme' },
        eligibleIf: { question: 'hasCow', op: '==', value: true },
        reasons: { eligible: { en: 'Yes.' } },
      }),
    );
    loadRules(dir);

    expect((await startEligibility({ sessionId: 't-1', language: 'ta' })).question.text).toBe(
      'Do you have a cow?',
    );
    setGeminiBackend(fakeGemini(() => ({ translations: ['உங்களிடம் பசு உள்ளதா?'] })));
    expect((await startEligibility({ sessionId: 't-2', language: 'ta' })).question.text).toBe(
      'உங்களிடம் பசு உள்ளதா?',
    );
  });
});
