// Loaded lazily by the landing page: sample exchanges built from the app's own mock data
// (src/mocks), so the phone demos show real answers, sources, SMS and fraud warnings.
import type { LanguageCode, QueryResponse } from '@gram-saathi/shared';
import { SCHEME_SHORTCUTS } from '@/features/chat/schemes';
import { countSmsSegments } from '@/features/sms/smsSegments';
import { FRAUD_WARNINGS } from '@/mocks';
import { mockGenerateAnswer, mockSearchSchemes } from '@/mocks/query';

export interface DemoExchange {
  question: string;
  response: QueryResponse;
}

/** A question the documents do not cover (it must not match any mock topic). */
const OFF_TOPIC: Record<LanguageCode, string> = {
  en: 'When will the new ration shop open in my village?',
  hi: 'मेरे गाँव में नई राशन दुकान कब खुलेगी?',
  mr: 'माझ्या गावात नवीन रेशन दुकान कधी उघडेल?',
  ta: 'என் கிராமத்தில் புதிய ரேஷன் கடை எப்போது திறக்கும்?',
};

/** First sentence only (ends at ".", "?", "!" or the Devanagari danda). */
function firstSentence(text: string): string {
  const match = /^.+?[.?!।](?=\s|$)/u.exec(text);
  return match ? match[0] : text;
}

function exchange(question: string, language: LanguageCode, brief = false): DemoExchange {
  // One source keeps the answer card short enough for a phone screen.
  const chunks = mockSearchSchemes(question, 1);
  const generated = mockGenerateAnswer(chunks, language);
  return {
    question,
    response: {
      sessionId: 'demo',
      transcript: question,
      detectedLanguage: language,
      answer: brief ? firstSentence(generated.answer) : generated.answer,
      sources: chunks.map(({ schemeId, schemeName, section, text }) => ({
        schemeId,
        schemeName,
        section,
        snippet: text,
      })),
      fraudWarning: FRAUD_WARNINGS[language],
      smsText: generated.smsText,
      smsSegments: countSmsSegments(generated.smsText),
      audioUrl: null,
      usedCache: false,
      notFound: generated.notFound,
    },
  };
}

/**
 * "How much money does PM-KISAN give?", answered from the sample PM-KISAN document.
 * `brief` keeps only the answer's first sentence, for small phone mock-ups.
 */
export function pmKisanExchange(language: LanguageCode, brief = false): DemoExchange {
  return exchange(SCHEME_SHORTCUTS[0].question[language], language, brief);
}

/** A question outside the documents: the answer says so and points to the CSC / panchayat. */
export function notFoundExchange(language: LanguageCode): DemoExchange {
  return exchange(OFF_TOPIC[language], language);
}
