import type {
  EligibilityAnswerRequest,
  EligibilityAnswerResponse,
  EligibilityProgress,
  EligibilityQuestion,
  EligibilityResult,
  EligibilityStartRequest,
  EligibilityStartResponse,
  LanguageCode,
} from '@gram-saathi/shared';
import { isMocked, PATHS } from '../../config/env';
import { LruCache } from '../../lib/cache';
import { HttpError } from '../../lib/httpError';
import { MOCK_ELIGIBILITY_QUESTIONS, evaluateMockEligibility } from '../../mocks';
import { isOfficialSourceUrl } from '../rag/documents';
import { parseAnswer } from './answers';
import { type Answers, evaluateSchemes, nextQuestion } from './engine';
import { localize } from './localize';
import {
  type EligibilityRules,
  type FlowQuestion,
  type LocalizedText,
  loadEligibilityRules,
} from './rules';

/** A wizard: which question comes next, and the results once nothing is left to ask. */
interface Flow {
  /** Accept free-form answers (e.g. voice transcripts) and interpret them. */
  freeForm: boolean;
  question(id: string): FlowQuestion | undefined;
  next(answers: Answers): { question: FlowQuestion; progress: EligibilityProgress } | undefined;
  results(answers: Answers, language: LanguageCode): Promise<EligibilityResult[]>;
}

/** Step-1 demo flow: four fixed questions, exact answers only. */
const MOCK_FLOW: Flow = {
  freeForm: false,
  question: (id) => MOCK_ELIGIBILITY_QUESTIONS.find((question) => question.id === id),
  next: (answers) => {
    const index = MOCK_ELIGIBILITY_QUESTIONS.findIndex((question) => !(question.id in answers));
    if (index === -1) return undefined;
    return {
      question: MOCK_ELIGIBILITY_QUESTIONS[index],
      progress: { current: index + 1, total: MOCK_ELIGIBILITY_QUESTIONS.length },
    };
  },
  results: async (answers, language) => evaluateMockEligibility(answers, language),
};

/** When a scheme fails and neither the condition nor the scheme gives a reason. */
const DEFAULT_NOT_ELIGIBLE: Required<LocalizedText> = {
  en: 'Based on your answers this scheme does not seem to fit. Please confirm at your nearest CSC or gram panchayat office.',
  hi: 'आपके जवाबों के हिसाब से यह योजना आप पर लागू नहीं लगती। कृपया नज़दीकी CSC केंद्र या ग्राम पंचायत कार्यालय में पुष्टि करें।',
  mr: 'तुमच्या उत्तरांनुसार ही योजना तुम्हाला लागू होत नाही असे दिसते. कृपया जवळच्या CSC केंद्रात किंवा ग्रामपंचायत कार्यालयात खात्री करा.',
  ta: 'உங்கள் பதில்களின்படி இந்தத் திட்டம் உங்களுக்குப் பொருந்தாது போல் தெரிகிறது. அருகிலுள்ள CSC அல்லது கிராம பஞ்சாயத்து அலுவலகத்தில் உறுதிப்படுத்துங்கள்.',
};

let rules: EligibilityRules | undefined;

/** Loads and validates data/eligibility. Throws a readable error for a broken rule file. */
export function loadRules(dir: string = PATHS.eligibility): EligibilityRules {
  rules = loadEligibilityRules(dir);
  return rules;
}

function rulesFlow(loaded: EligibilityRules): Flow {
  return {
    freeForm: true,
    question: (id) => loaded.questions.find((question) => question.id === id),
    next: (answers) => nextQuestion(loaded, answers),
    results: async (answers, language) => {
      const outcomes = evaluateSchemes(loaded, answers, DEFAULT_NOT_ELIGIBLE);
      const texts = await localize(
        outcomes.flatMap(({ scheme, reason }) => [scheme.schemeName, reason]),
        language,
      );
      return outcomes.map(({ scheme, eligible }, index) => ({
        schemeId: scheme.schemeId,
        schemeName: texts[index * 2],
        eligible,
        reason: texts[index * 2 + 1],
      }));
    },
  };
}

function getFlow(): Flow {
  if (isMocked('eligibility')) return MOCK_FLOW;
  const loaded = rules ?? loadRules();
  const unverified = loaded.schemes.filter(
    (scheme) => !scheme.verified || !isOfficialSourceUrl(scheme.source),
  );
  if (unverified.length > 0) {
    throw new HttpError(
      503,
      'ELIGIBILITY_RULES_UNVERIFIED',
      'Eligibility results are disabled until every rule is verified against a secure official source.',
    );
  }
  return rulesFlow(loaded);
}

interface Session {
  language: LanguageCode;
  answers: Answers;
  /** The question we are waiting for. */
  questionId: string;
}

/** Wizard state per sessionId, in memory: lost on restart (the client then starts over). */
const sessions = new LruCache<Session>({ maxEntries: 10_000, ttlMs: 60 * 60_000 });

export async function startEligibility({
  sessionId,
  language,
}: EligibilityStartRequest): Promise<EligibilityStartResponse> {
  const step = getFlow().next({});
  if (!step) throw new Error('The eligibility rules have no questions');
  sessions.set(sessionId, { language, answers: {}, questionId: step.question.id });
  return { question: await present(step.question, language), progress: step.progress };
}

export async function answerEligibility({
  sessionId,
  questionId,
  answer,
}: EligibilityAnswerRequest): Promise<EligibilityAnswerResponse> {
  const flow = getFlow();
  const session = sessions.get(sessionId);
  const question = session && flow.question(session.questionId);
  if (!session || !question) {
    throw new HttpError(
      404,
      'SESSION_NOT_FOUND',
      'No eligibility session for this sessionId. Call /api/eligibility/start first.',
    );
  }
  if (question.id !== questionId) {
    throw new HttpError(
      409,
      'QUESTION_MISMATCH',
      `Expected an answer to "${question.id}", got "${questionId}".`,
    );
  }

  const shownLabels =
    question.options &&
    (await localize(
      question.options.map((o) => o.label),
      session.language,
    ));
  // A bad or unclear answer throws here and the session stays on the same question.
  session.answers[question.id] = await parseAnswer(question, answer, {
    freeForm: flow.freeForm,
    shownLabels,
  });

  const step = flow.next(session.answers);
  if (step) {
    session.questionId = step.question.id;
    sessions.set(sessionId, session); // also restarts the expiry clock
    return {
      done: false,
      question: await present(step.question, session.language),
      progress: step.progress,
    };
  }
  sessions.delete(sessionId);
  return { done: true, results: await flow.results(session.answers, session.language) };
}

/** Contract shape of a question, in the session language. */
async function present(
  question: FlowQuestion,
  language: LanguageCode,
): Promise<EligibilityQuestion> {
  const labels = question.options?.map((option) => option.label) ?? [];
  const [text, ...options] = await localize([question.text, ...labels], language);
  return {
    id: question.id,
    type: question.type,
    text,
    ...(question.options && { options }),
  };
}
