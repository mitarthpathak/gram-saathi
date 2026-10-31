/**
 * In-browser implementation of the API, used when VITE_USE_MOCKS=true so the UI can be built
 * and demoed with no server. query.ts, eligibility.ts and faq.ts are verbatim copies of
 * server/src/mocks/ (keep them in sync); this file mimics what the server modules do with them.
 */
import type {
  EligibilityQuestion,
  EligibilityStartResponse,
  LanguageCode,
  QueryResponse,
} from '@gram-saathi/shared';
import { countSmsSegments, truncateToSegments } from '@/features/sms/smsSegments';
import { ApiError, type Api } from '@/lib/api';
import { config } from '@/lib/config';
import {
  MOCK_ELIGIBILITY_QUESTIONS,
  evaluateMockEligibility,
  type MockAnswers,
} from './eligibility';
import { mockTopFaq } from './faq';
import {
  mockDetectLanguage,
  mockGenerateAnswer,
  mockGreeting,
  mockSmallTalk,
  mockSearchSchemes,
  mockTranscribe,
} from './query';

// Same text as server/src/modules/chat/fraudWarning.ts.
const FRAUD_WARNINGS: Record<LanguageCode, string> = {
  en: 'Beware of fraud: applying for government schemes is free. Never share your OTP or bank PIN with anyone. Use only .gov.in websites or your nearest CSC.',
  hi: 'धोखाधड़ी से सावधान: सरकारी योजनाओं में आवेदन मुफ़्त है। अपना OTP या बैंक PIN किसी को न बताएं। केवल .gov.in वेबसाइट या नज़दीकी CSC केंद्र का ही उपयोग करें।',
  mr: 'फसवणुकीपासून सावध रहा: सरकारी योजनांसाठी अर्ज मोफत आहे. तुमचा OTP किंवा बँक PIN कोणालाही सांगू नका. फक्त .gov.in संकेतस्थळ किंवा जवळच्या CSC केंद्राचाच वापर करा.',
  ta: 'மோசடி எச்சரிக்கை: அரசு திட்டங்களுக்கு விண்ணப்பிக்க கட்டணம் இல்லை. உங்கள் OTP அல்லது வங்கி PIN-ஐ யாரிடமும் பகிர வேண்டாம். .gov.in இணையதளங்கள் அல்லது அருகிலுள்ள பொது சேவை மையத்தை (CSC) மட்டுமே பயன்படுத்துங்கள்.',
};

const delay = <T>(value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), config.mockLatencyMs));

const askedBefore = new Set<string>();

function answer(
  text: string,
  hint: LanguageCode | undefined,
  sessionId: string,
  transcript?: string,
  dialectHint?: string,
) {
  const language = mockDetectLanguage(text, hint, dialectHint);
  const greeting = mockGreeting(text, language);
  const smallTalk = greeting ? undefined : mockSmallTalk(text, language);
  const cacheKey = `${language}:${text.toLowerCase().trim()}`;
  const usedCache = !greeting && !smallTalk && askedBefore.has(cacheKey);
  if (!greeting && !smallTalk) askedBefore.add(cacheKey);

  const chunks = greeting || smallTalk ? [] : mockSearchSchemes(text, 3);
  const generated = greeting
    ? { answer: greeting.answer, smsText: greeting.sms, notFound: false }
    : smallTalk
      ? { answer: smallTalk.answer, smsText: smallTalk.sms, notFound: false }
      : mockGenerateAnswer(chunks, language);
  const response: QueryResponse = {
    sessionId,
    transcript,
    detectedLanguage: language,
    answer: generated.answer,
    sources: generated.notFound
      ? []
      : chunks.map(({ schemeId, schemeName, section, text: snippet }) => ({
          schemeId,
          schemeName,
          section,
          snippet,
        })),
    fraudWarning: FRAUD_WARNINGS[language],
    smsText: generated.smsText,
    smsSegments: countSmsSegments(generated.smsText),
    audioUrl: null,
    usedCache,
    notFound: generated.notFound,
  };
  return delay(response);
}

interface WizardSession {
  language: LanguageCode;
  step: number;
  answers: MockAnswers;
}

const wizards = new Map<string, WizardSession>();

function questionAt(step: number, language: LanguageCode): EligibilityStartResponse {
  const { id, type, text, options } = MOCK_ELIGIBILITY_QUESTIONS[step];
  const question: EligibilityQuestion = { id, type, text: text[language] };
  if (options) question.options = options.map((option) => option.label[language]);
  return { question, progress: { current: step + 1, total: MOCK_ELIGIBILITY_QUESTIONS.length } };
}

export const mockApi: Api = {
  health: () => delay({ status: 'ok', mocks: true }),

  chatQuery: ({ text, language, dialectHint, sessionId }) =>
    answer(text, language, sessionId, undefined, dialectHint),

  voiceQuery: ({ language, dialectHint, sessionId }) => {
    const transcript = mockTranscribe(language);
    return answer(transcript, language, sessionId, transcript, dialectHint);
  },

  eligibilityStart: ({ sessionId, language }) => {
    wizards.set(sessionId, { language, step: 0, answers: {} });
    return delay(questionAt(0, language));
  },

  eligibilityAnswer: async ({ sessionId, questionId, answer: value }) => {
    const wizard = wizards.get(sessionId);
    if (!wizard) throw new ApiError(404, 'SESSION_NOT_FOUND', 'Call eligibilityStart first.');
    const question = MOCK_ELIGIBILITY_QUESTIONS[wizard.step];
    if (question.id !== questionId) {
      throw new ApiError(409, 'QUESTION_MISMATCH', `Expected an answer to "${question.id}".`);
    }
    const option = question.options?.find((o) => o.label[wizard.language] === value);
    wizard.answers[question.id] = option ? option.value : value;
    wizard.step += 1;

    if (wizard.step < MOCK_ELIGIBILITY_QUESTIONS.length) {
      return delay({ done: false, ...questionAt(wizard.step, wizard.language) });
    }
    wizards.delete(sessionId);
    return delay({ done: true, results: evaluateMockEligibility(wizard.answers, wizard.language) });
  },

  smsCompress: ({ text }) => {
    const sms = truncateToSegments(text, 2);
    return delay({ sms, segments: countSmsSegments(sms) });
  },

  faqTop: (lang) => delay({ items: mockTopFaq(lang) }),

  tts: () => delay({ audioUrl: null, basis: 'none' as const }),

  // The client mocks have no dialect registry; unknown dialects are treated as experimental.
  dialects: () => delay({ items: [] }),
};
