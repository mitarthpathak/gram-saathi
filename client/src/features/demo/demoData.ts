import type { LanguageCode, QueryResponse } from '@gram-saathi/shared';

export interface DemoSample {
  id: string;
  title: string;
  question: string;
  transcript: string;
  response: QueryResponse;
}

function sample(id: string, title: string, question: string, transcript: string, language: LanguageCode, answer: string, fraudWarning: string, dialect?: QueryResponse['dialect']): DemoSample {
  return {
    id, title, question, transcript,
    response: {
      sessionId: 'demo-session', transcript, detectedLanguage: language, dialect,
      dialectCandidates: dialect ? [] : undefined,
      answer,
      sources: [{ schemeId: 'pm-kisan', schemeName: 'PM-KISAN Samman Nidhi', section: 'Benefits', snippet: '₹6,000 per year in three equal instalments.' }],
      fraudWarning, smsText: answer, smsSegments: 1, audioUrl: null, usedCache: true, notFound: false,
    },
  };
}

export const DEMO_SAMPLES: DemoSample[] = [
  sample('hi-wagdi', 'Hindi + Wagdi', 'प्रधानमंत्री किसान योजना में कितनी राशि मिलती है?', 'मने किसान योजना में कितला रुपिया मले?', 'hi', 'पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं। यह राशि ₹2,000 की तीन बराबर किस्तों में दी जाती है।', 'योजनाओं में आवेदन निःशुल्क है। OTP या बैंक PIN किसी को न बताएं।', { id: 'wagdi', name: 'Wagdi', nativeName: 'वागड़ी', confidence: 'high' }),
  sample('mr', 'मराठी', 'पीएम किसान योजनेत किती मदत मिळते?', 'पीएम किसान योजनेत किती मदत मिळते?', 'mr', 'पात्र शेतकरी कुटुंबांना वर्षाला ₹6,000 तीन समान हप्त्यांत मिळतात.', 'योजनेसाठी अर्ज विनामूल्य आहे. OTP किंवा बँक PIN कोणालाही सांगू नका.'),
  sample('ta', 'தமிழ்', 'பிஎம் கிசான் திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்?', 'பிஎம் கிசான் திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்?', 'ta', 'தகுதியுள்ள விவசாயக் குடும்பங்களுக்கு ஆண்டுக்கு ₹6,000 மூன்று தவணைகளில் வழங்கப்படும்.', 'அரசுத் திட்டங்களுக்கு விண்ணப்பம் இலவசம். OTP அல்லது வங்கி PIN-ஐ பகிர வேண்டாம்.'),
  sample('en', 'English', 'How much does PM-KISAN pay each year?', 'How much does PM-KISAN pay each year?', 'en', 'Eligible farmer families receive ₹6,000 each year in three equal instalments of ₹2,000.', 'Government scheme applications are free. Never share your OTP or bank PIN.'),
];

export function findDemoSample(id: string): DemoSample | undefined {
  return DEMO_SAMPLES.find((item) => item.id === id);
}

export function fallbackDemoSample(language: LanguageCode): DemoSample {
  return DEMO_SAMPLES.find((item) => item.response.detectedLanguage === language) ?? DEMO_SAMPLES[0]!;
}
