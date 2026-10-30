import type {
  EligibilityAnswerRequest,
  EligibilityAnswerResponse,
  EligibilityAnswerValue,
  EligibilityQuestion,
  EligibilityQuestionType,
  EligibilityResult,
  EligibilityStartRequest,
  EligibilityStartResponse,
  LanguageCode,
} from '@gram-saathi/shared';
import { isMocked } from '../../config/env';
import { HttpError, NotImplementedError } from '../../lib/httpError';
import { MOCK_ELIGIBILITY_QUESTIONS, evaluateMockEligibility } from '../../mocks';

type Localized = Record<LanguageCode, string>;

interface FlowQuestion {
  id: string;
  type: EligibilityQuestionType;
  text: Localized;
  /** "choice" only: canonical values with a label per language. */
  options?: { value: string; label: Localized }[];
  /** "number" only: inclusive range. */
  min?: number;
  max?: number;
}

/** Canonical answers by question id (choice answers stored as values, not labels). */
type Answers = Record<string, number | boolean | string>;

/** A wizard: localized questions plus deterministic rules. */
interface EligibilityFlow {
  questions: FlowQuestion[];
  evaluate: (answers: Answers, language: LanguageCode) => EligibilityResult[];
}

const MOCK_FLOW: EligibilityFlow = {
  questions: MOCK_ELIGIBILITY_QUESTIONS,
  evaluate: evaluateMockEligibility,
};

interface Session {
  language: LanguageCode;
  /** Index of the question we are waiting for. */
  step: number;
  answers: Answers;
}

/** Wizard state per sessionId. In memory: lost on restart, and the client then starts over. */
const sessions = new Map<string, Session>();

function getFlow(): EligibilityFlow {
  if (isMocked('eligibility')) return MOCK_FLOW;
  // TODO(step-2): build the flow from the eligibility criteria in data/schemes/*.md (questions,
  //   allowed answers, one rule per scheme). Keep the rules deterministic code, never an LLM:
  //   the same answers must always give the same result. Gemini may only phrase the reasons.
  throw new NotImplementedError('eligibility.getFlow');
}

export async function startEligibility({
  sessionId,
  language,
}: EligibilityStartRequest): Promise<EligibilityStartResponse> {
  const flow = getFlow();
  sessions.set(sessionId, { language, step: 0, answers: {} });
  return questionAt(flow, 0, language);
}

export async function answerEligibility({
  sessionId,
  questionId,
  answer,
}: EligibilityAnswerRequest): Promise<EligibilityAnswerResponse> {
  const flow = getFlow();
  const session = sessions.get(sessionId);
  if (!session) {
    throw new HttpError(
      404,
      'SESSION_NOT_FOUND',
      'No eligibility session for this sessionId. Call /api/eligibility/start first.',
    );
  }

  const question = flow.questions[session.step];
  if (question.id !== questionId) {
    throw new HttpError(
      409,
      'QUESTION_MISMATCH',
      `Expected an answer to "${question.id}", got "${questionId}".`,
    );
  }
  session.answers[question.id] = toCanonicalAnswer(question, answer, session.language);
  session.step += 1;

  if (session.step < flow.questions.length) {
    return { done: false, ...questionAt(flow, session.step, session.language) };
  }
  sessions.delete(sessionId);
  return { done: true, results: flow.evaluate(session.answers, session.language) };
}

function questionAt(
  flow: EligibilityFlow,
  step: number,
  language: LanguageCode,
): EligibilityStartResponse {
  const { id, type, text, options } = flow.questions[step];
  const question: EligibilityQuestion = { id, type, text: text[language] };
  if (options) question.options = options.map((option) => option.label[language]);
  return { question, progress: { current: step + 1, total: flow.questions.length } };
}

/** Checks the answer against the question type; a choice label becomes its canonical value. */
function toCanonicalAnswer(
  question: FlowQuestion,
  answer: EligibilityAnswerValue,
  language: LanguageCode,
): number | boolean | string {
  const invalid = (expected: string) =>
    new HttpError(400, 'INVALID_ANSWER', `Question "${question.id}" expects ${expected}.`);

  switch (question.type) {
    case 'number': {
      const { min = 0, max = Number.MAX_SAFE_INTEGER } = question;
      if (typeof answer !== 'number' || !Number.isFinite(answer) || answer < min || answer > max) {
        throw invalid(`a number from ${min} to ${max}`);
      }
      return answer;
    }
    case 'boolean':
      if (typeof answer !== 'boolean') throw invalid('true or false');
      return answer;
    case 'choice': {
      const options = question.options ?? [];
      const match = options.find((o) => o.label[language] === answer || o.value === answer);
      if (!match) throw invalid(`one of: ${options.map((o) => o.label[language]).join(', ')}`);
      return match.value;
    }
  }
}
