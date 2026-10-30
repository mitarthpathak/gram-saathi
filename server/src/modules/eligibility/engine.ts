/**
 * Deterministic eligibility evaluation: the same answers always give the same result, and no AI
 * is involved. Conditions use three-valued logic (true / false / unknown) so a scheme can be
 * decided before every question is answered, and questions that cannot change any result are
 * skipped.
 */
import type { EligibilityProgress } from '@gram-saathi/shared';
import type {
  Comparison,
  Condition,
  EligibilityRules,
  LocalizedText,
  QuestionDef,
  SchemeRule,
} from './rules';

export type AnswerValue = number | boolean | string;
/** Canonical answers by question id: numbers, booleans and choice option values. */
export type Answers = Record<string, AnswerValue>;
/** undefined = unknown: depends on a question that has not been answered yet. */
export type Truth = boolean | undefined;

export function evaluate(condition: Condition, answers: Answers): Truth {
  if ('all' in condition) {
    let unknown = false;
    for (const part of condition.all) {
      const result = evaluate(part, answers);
      if (result === false) return false;
      if (result === undefined) unknown = true;
    }
    return unknown ? undefined : true;
  }
  if ('any' in condition) {
    let unknown = false;
    for (const part of condition.any) {
      const result = evaluate(part, answers);
      if (result === true) return true;
      if (result === undefined) unknown = true;
    }
    return unknown ? undefined : false;
  }
  if ('not' in condition) {
    const result = evaluate(condition.not, answers);
    return result === undefined ? undefined : !result;
  }
  const answer = answers[condition.question];
  return answer === undefined ? undefined : compare(condition, answer);
}

function compare(comparison: Comparison, answer: AnswerValue): boolean {
  switch (comparison.op) {
    case '==':
      return answer === comparison.value;
    case '!=':
      return answer !== comparison.value;
    case '<':
      return typeof answer === 'number' && answer < comparison.value;
    case '<=':
      return typeof answer === 'number' && answer <= comparison.value;
    case '>':
      return typeof answer === 'number' && answer > comparison.value;
    case '>=':
      return typeof answer === 'number' && answer >= comparison.value;
    case 'between': {
      const [min, max] = comparison.value;
      return typeof answer === 'number' && answer >= min && answer <= max;
    }
    case 'in':
      return comparison.value.includes(answer as string | number);
  }
}

/** Unanswered questions that can still change the result of `condition`. */
function collectPending(condition: Condition, answers: Answers, pending: Set<string>): void {
  if (evaluate(condition, answers) !== undefined) return; // decided: nothing left to ask
  if ('all' in condition) condition.all.forEach((part) => collectPending(part, answers, pending));
  else if ('any' in condition)
    condition.any.forEach((part) => collectPending(part, answers, pending));
  else if ('not' in condition) collectPending(condition.not, answers, pending);
  else pending.add(condition.question);
}

/** Questions still worth asking, in asking order. */
export function pendingQuestions(rules: EligibilityRules, answers: Answers): QuestionDef[] {
  const pending = new Set<string>();
  for (const scheme of rules.schemes) collectPending(scheme.eligibleIf, answers, pending);
  return rules.questions.filter((question) => pending.has(question.id));
}

/** The next question and wizard progress, or undefined when every scheme is decided. */
export function nextQuestion(
  rules: EligibilityRules,
  answers: Answers,
): { question: QuestionDef; progress: EligibilityProgress } | undefined {
  const pending = pendingQuestions(rules, answers);
  if (pending.length === 0) return undefined;
  const answered = Object.keys(answers).length;
  // `total` is an upper bound: later answers can make more questions unnecessary.
  return {
    question: pending[0],
    progress: { current: answered + 1, total: answered + pending.length },
  };
}

export interface SchemeOutcome {
  scheme: SchemeRule;
  eligible: boolean;
  reason: LocalizedText;
}

/** One outcome per scheme, eligible schemes first (otherwise in file order). */
export function evaluateSchemes(
  rules: EligibilityRules,
  answers: Answers,
  defaultReason: LocalizedText,
): SchemeOutcome[] {
  const outcomes = rules.schemes.map((scheme): SchemeOutcome => {
    // Unknown only if questions were skipped by mistake: never claim eligibility on a guess.
    const eligible = evaluate(scheme.eligibleIf, answers) === true;
    const reason = eligible
      ? scheme.reasons.eligible
      : (failureReason(scheme.eligibleIf, answers) ?? scheme.reasons.notEligible ?? defaultReason);
    return { scheme, eligible, reason };
  });
  return outcomes.sort((a, b) => Number(b.eligible) - Number(a.eligible));
}

/** The `reason` of the condition that made `condition` false, looking into failed `all` parts. */
export function failureReason(condition: Condition, answers: Answers): LocalizedText | undefined {
  if (condition.reason) return condition.reason;
  if ('all' in condition) {
    const failed = condition.all.find((part) => evaluate(part, answers) === false);
    return failed && failureReason(failed, answers);
  }
  return undefined;
}
