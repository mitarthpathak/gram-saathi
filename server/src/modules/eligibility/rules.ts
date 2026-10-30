/**
 * Eligibility rules are data: data/eligibility/questions.json holds the shared questions and
 * every other data/eligibility/*.json file holds one scheme's conditions. This file defines and
 * validates that format; engine.ts evaluates it.
 */
import type { EligibilityQuestionType } from '@gram-saathi/shared';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const comment = z.string().optional();

/** English is required; a missing language is machine-translated at runtime (reviewed text wins). */
export const localizedTextSchema = z.strictObject({
  en: z.string().trim().min(1),
  hi: z.string().trim().min(1).optional(),
  mr: z.string().trim().min(1).optional(),
  ta: z.string().trim().min(1).optional(),
});
export type LocalizedText = z.infer<typeof localizedTextSchema>;

const id = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, 'letters, digits, "-" and "_" only');

const questionBase = {
  $comment: comment,
  id,
  text: localizedTextSchema,
  /** Extra instructions for turning a free-form answer into a value, e.g. unit conversions. */
  parseHint: z.string().optional(),
};

export const questionSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...questionBase,
    type: z.literal('number'),
    min: z.number().default(0),
    max: z.number(),
    /** Unit the answer is stored in, e.g. "years" or "acres". */
    unit: z.string().optional(),
    /** Words accepted after a bare number without asking the AI, e.g. ["acre", "एकड़"]. */
    unitWords: z.array(z.string()).optional(),
  }),
  z.strictObject({ ...questionBase, type: z.literal('boolean') }),
  z.strictObject({
    ...questionBase,
    type: z.literal('choice'),
    options: z.array(z.strictObject({ value: id, label: localizedTextSchema })).min(2),
  }),
]);
export type QuestionDef = z.infer<typeof questionSchema>;

/** Optional on every condition: shown as the reason when this condition makes a scheme fail. */
const conditionMeta = { $comment: comment, reason: localizedTextSchema.optional() };

const comparisonSchema = z.discriminatedUnion('op', [
  z.strictObject({
    ...conditionMeta,
    question: z.string(),
    op: z.enum(['==', '!=']),
    value: z.union([z.string(), z.number(), z.boolean()]),
  }),
  z.strictObject({
    ...conditionMeta,
    question: z.string(),
    op: z.enum(['<', '<=', '>', '>=']),
    value: z.number(),
  }),
  z.strictObject({
    ...conditionMeta,
    question: z.string(),
    op: z.literal('between'),
    value: z.tuple([z.number(), z.number()]),
  }),
  z.strictObject({
    ...conditionMeta,
    question: z.string(),
    op: z.literal('in'),
    value: z.array(z.union([z.string(), z.number()])).min(1),
  }),
]);
export type Comparison = z.infer<typeof comparisonSchema>;

interface ConditionMeta {
  $comment?: string;
  reason?: LocalizedText;
}
/** A comparison on one answer, or all / any / not of other conditions. */
export type Condition =
  | Comparison
  | (ConditionMeta & { all: Condition[] })
  | (ConditionMeta & { any: Condition[] })
  | (ConditionMeta & { not: Condition });

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    comparisonSchema,
    z.strictObject({ ...conditionMeta, all: z.array(conditionSchema).min(1) }),
    z.strictObject({ ...conditionMeta, any: z.array(conditionSchema).min(1) }),
    z.strictObject({ ...conditionMeta, not: conditionSchema }),
  ]),
);

export const schemeRuleSchema = z.strictObject({
  $comment: comment,
  schemeId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase-with-dashes'),
  schemeName: localizedTextSchema,
  /** false until someone has checked every condition against the official guidelines. */
  verified: z.boolean(),
  /** Where the rule comes from (official guideline URL). */
  source: z.string().optional(),
  eligibleIf: conditionSchema,
  reasons: z.strictObject({
    eligible: localizedTextSchema,
    /** Used when no failing condition has its own `reason`. */
    notEligible: localizedTextSchema.optional(),
  }),
  /** Questions only this scheme needs; they are asked after the shared ones. */
  questions: z.array(questionSchema).optional(),
});
export type SchemeRule = z.infer<typeof schemeRuleSchema>;

const questionBankSchema = z.strictObject({
  $comment: comment,
  questions: z.array(questionSchema).min(1),
});

export interface EligibilityRules {
  /** All questions, in the order they are asked. */
  questions: QuestionDef[];
  schemes: SchemeRule[];
}

export const QUESTION_BANK_FILE = 'questions.json';

/** Reads and validates every rule file. Throws one error that names the file and the problem. */
export function loadEligibilityRules(dir: string): EligibilityRules {
  const questions = [...readJson(path.join(dir, QUESTION_BANK_FILE), questionBankSchema).questions];
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json') && file !== QUESTION_BANK_FILE)
    .sort();

  const schemes: SchemeRule[] = [];
  for (const file of files) {
    const scheme = readJson(path.join(dir, file), schemeRuleSchema);
    if (file !== `${scheme.schemeId}.json`) {
      throw new Error(
        `${file}: rename the file to ${scheme.schemeId}.json (it must match schemeId)`,
      );
    }
    questions.push(...(scheme.questions ?? []));
    schemes.push(scheme);
  }
  if (schemes.length === 0) throw new Error(`No scheme rule files (*.json) in ${dir}`);

  const rules = { questions, schemes };
  validateRules(rules);
  return rules;
}

function readJson<T>(file: string, schema: z.ZodType<T>): T {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${path.basename(file)}: ${(error as Error).message}`, { cause: error });
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`${path.basename(file)} is invalid:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Cross-file checks the schemas cannot do: unique ids, known questions, sensible comparisons. */
export function validateRules({ questions, schemes }: EligibilityRules): void {
  const byId = new Map<string, QuestionDef>();
  for (const question of questions) {
    if (byId.has(question.id)) throw new Error(`Question "${question.id}" is defined twice`);
    byId.set(question.id, question);
  }
  const schemeIds = new Set<string>();
  for (const scheme of schemes) {
    if (schemeIds.has(scheme.schemeId))
      throw new Error(`Scheme "${scheme.schemeId}" is defined twice`);
    schemeIds.add(scheme.schemeId);
    for (const comparison of comparisons(scheme.eligibleIf)) {
      const problem = checkComparison(comparison, byId.get(comparison.question), byId);
      if (problem) throw new Error(`${scheme.schemeId}.json: ${problem}`);
    }
  }
}

function checkComparison(
  comparison: Comparison,
  question: QuestionDef | undefined,
  known: Map<string, QuestionDef>,
): string | undefined {
  const where = `condition on "${comparison.question}"`;
  if (!question) return `${where}: no such question (known: ${[...known.keys()].join(', ')})`;

  const values = Array.isArray(comparison.value) ? comparison.value : [comparison.value];
  switch (question.type) {
    case 'number':
      if (values.some((value) => typeof value !== 'number'))
        return `${where}: compare with numbers`;
      return undefined;
    case 'boolean':
      if (comparison.op !== '==' && comparison.op !== '!=') return `${where}: use "==" or "!="`;
      if (typeof comparison.value !== 'boolean') return `${where}: compare with true or false`;
      return undefined;
    case 'choice': {
      if (comparison.op !== '==' && comparison.op !== '!=' && comparison.op !== 'in') {
        return `${where}: use "==", "!=" or "in"`;
      }
      const allowed = question.options.map((option) => option.value);
      const unknown = values.filter((value) => !allowed.includes(String(value)));
      return unknown.length > 0
        ? `${where}: unknown option(s) ${unknown.join(', ')} (options: ${allowed.join(', ')})`
        : undefined;
    }
  }
}

/** Every comparison (leaf) in a condition tree. */
export function comparisons(condition: Condition): Comparison[] {
  if ('all' in condition) return condition.all.flatMap(comparisons);
  if ('any' in condition) return condition.any.flatMap(comparisons);
  if ('not' in condition) return comparisons(condition.not);
  return [condition];
}

/** What the wizard needs from a question: met by rule-file questions and by the mock flow. */
export interface FlowQuestion {
  id: string;
  type: EligibilityQuestionType;
  text: LocalizedText;
  options?: { value: string; label: LocalizedText }[];
  min?: number;
  max?: number;
  unit?: string;
  unitWords?: string[];
  parseHint?: string;
}
