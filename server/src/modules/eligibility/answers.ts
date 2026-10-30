/**
 * Turns an answer into the canonical value the rules compare: a number, a boolean or a choice
 * option value. Exact values and common words are handled here without AI; only a free-form
 * answer that is still ambiguous ("do bigha zameen", "main kisaan hu") goes to Gemini, and only
 * to read the value: the eligibility decision itself stays in engine.ts.
 */
import type { EligibilityAnswerValue } from '@gram-saathi/shared';
import { z } from 'zod';
import { generateJson } from '../../lib/geminiClient';
import { HttpError } from '../../lib/httpError';
import type { AnswerValue } from './engine';
import { buildParseInput, PARSE_ANSWER_PROMPT, understoodSchema } from './prompts';
import type { FlowQuestion } from './rules';

export interface ParseOptions {
  /** Accept free-form text such as a voice transcript, and interpret it (with AI if needed). */
  freeForm: boolean;
  /** Option labels exactly as the client was shown them (they may be machine-translated). */
  shownLabels?: string[];
}

export async function parseAnswer(
  question: FlowQuestion,
  answer: EligibilityAnswerValue,
  options: ParseOptions,
): Promise<AnswerValue> {
  const freeText = options.freeForm && typeof answer === 'string' ? answer : undefined;

  switch (question.type) {
    case 'number': {
      const min = question.min ?? 0;
      const max = question.max ?? Number.MAX_SAFE_INTEGER;
      const value =
        typeof answer === 'number'
          ? answer
          : freeText !== undefined
            ? (parseNumberText(freeText, question.unitWords) ??
              (await interpret(question, freeText, numberValueSchema(question))))
            : undefined;
      if (value === undefined || !Number.isFinite(value) || value < min || value > max) {
        throw invalid(question, `a number from ${min} to ${max}`);
      }
      return value;
    }
    case 'boolean': {
      if (typeof answer === 'boolean') return answer;
      if (freeText === undefined) throw invalid(question, 'true or false');
      return parseYesNo(freeText) ?? (await interpret(question, freeText, booleanValueSchema));
    }
    case 'choice': {
      const choices = question.options ?? [];
      const match =
        typeof answer === 'string' ? matchOption(question, answer, options.shownLabels) : undefined;
      if (match) return match;
      if (freeText === undefined || choices.length === 0) {
        const labels = options.shownLabels ?? choices.map((choice) => choice.label.en);
        throw invalid(question, `one of: ${labels.join(', ')}`);
      }
      const values = choices.map((choice) => choice.value);
      return interpret(question, freeText, z.enum(values).describe('The matching option value.'));
    }
  }
}

function invalid(question: FlowQuestion, expected: string): HttpError {
  return new HttpError(400, 'INVALID_ANSWER', `Question "${question.id}" expects ${expected}.`);
}

const numberValueSchema = (question: FlowQuestion) =>
  z.number().describe(`The answer as a number${question.unit ? ` in ${question.unit}` : ''}.`);
const booleanValueSchema = z.boolean().describe('true for yes, false for no.');

/** Asks Gemini to read the value; a vague answer becomes 422 UNCLEAR_ANSWER (ask again). */
async function interpret<T extends AnswerValue>(
  question: FlowQuestion,
  answer: string,
  valueSchema: z.ZodType<T>,
): Promise<T> {
  const result = await generateJson({
    label: 'eligibility-answer',
    system: PARSE_ANSWER_PROMPT,
    input: buildParseInput(question, answer),
    schema: z.object({ value: valueSchema, understood: understoodSchema }),
    maxOutputTokens: 512,
  });
  if (!result.understood) {
    throw new HttpError(
      422,
      'UNCLEAR_ANSWER',
      `Could not understand the answer to "${question.id}". Ask the question again.`,
    );
  }
  return result.value;
}

/** Case, Unicode form, punctuation and spacing do not matter when comparing answers. */
export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[.,!?।॥"'“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const YES = new Set(
  [
    ...['yes', 'y', 'yeah', 'yep', 'true', 'haan', 'han', 'haa', 'ha', 'ji', 'ji haan', 'haan ji'],
    ...['hoy', 'ho', 'aam', 'aama', 'aamam'],
    ...['हाँ', 'हां', 'हा', 'जी', 'जी हाँ', 'जी हां', 'हाँ जी', 'हां जी', 'होय', 'हो'],
    ...['ஆம்', 'ஆமா', 'ஆமாம்'],
  ].map(normalizeAnswer),
);
const NO = new Set(
  [
    ...['no', 'n', 'nope', 'false', 'nahi', 'nahin', 'nai', 'na', 'naahi', 'illai', 'illa'],
    ...['नहीं', 'नही', 'ना', 'नाही', 'இல்லை', 'இல்ல'],
  ].map(normalizeAnswer),
);

/** Plain yes / no words in en, hi, mr and ta (script or romanised); undefined otherwise. */
export function parseYesNo(text: string): boolean | undefined {
  const word = normalizeAnswer(text);
  if (YES.has(word)) return true;
  if (NO.has(word)) return false;
  return undefined;
}

/**
 * A bare number such as "35", "1,50,000", "३५" or "௩௫", optionally followed by one of the
 * question's unit words ("2 acres"). Anything else ("do bigha") returns undefined.
 */
export function parseNumberText(text: string, unitWords: string[] = []): number | undefined {
  const digits = text
    .replace(/[०-९]/g, (digit) => String(digit.charCodeAt(0) - 0x0966))
    .replace(/[௦-௯]/g, (digit) => String(digit.charCodeAt(0) - 0x0be6))
    .replace(/(?<=\d),(?=\d)/g, '');
  const match = /^\s*(\d+(?:\.\d+)?)\s*(.*)$/s.exec(digits);
  if (!match) return undefined;
  const rest = normalizeAnswer(match[2]);
  if (rest && !unitWords.some((word) => normalizeAnswer(word) === rest)) return undefined;
  return Number(match[1]);
}

/** The option whose value or label (in any language, or as shown) equals the answer. */
export function matchOption(
  question: FlowQuestion,
  answer: string,
  shownLabels: string[] = [],
): string | undefined {
  const wanted = normalizeAnswer(answer);
  return question.options?.find((option, index) =>
    [option.value, ...Object.values(option.label), shownLabels[index]].some(
      (label) => label !== undefined && normalizeAnswer(label) === wanted,
    ),
  )?.value;
}
