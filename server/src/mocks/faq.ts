/**
 * Mock "top questions" per language, served for offline / low-bandwidth mode.
 *
 * Identical copies live in server/src/mocks/ and client/src/mocks/. Edit both together.
 */
import type { FaqItem, LanguageCode } from '@gram-saathi/shared';
import { mockSource } from './query';

/** [question, answer] pairs; the n-th pair in every language cites FAQ_SOURCES[n]. */
const FAQ_TEXT: Record<LanguageCode, [string, string][]> = {
  en: [
    [
      'How much money does PM-KISAN give?',
      '₹6,000 a year, in three instalments of ₹2,000, sent directly to the farmer’s bank account.',
    ],
    [
      'How do I get an Ayushman card?',
      'Check your name at beneficiary.nha.gov.in or call 14555. Then get the card free at a CSC or empanelled hospital with your Aadhaar.',
    ],
    [
      'Do I have to pay a fee to apply?',
      'No. Applying for government schemes is free. Never pay an agent and never share your OTP.',
    ],
  ],
  hi: [
    [
      'पीएम-किसान में कितना पैसा मिलता है?',
      'साल में ₹6,000, ₹2,000 की तीन किस्तों में, सीधे किसान के बैंक खाते में।',
    ],
    [
      'आयुष्मान कार्ड कैसे बनवाएं?',
      'beneficiary.nha.gov.in पर नाम देखें या 14555 पर कॉल करें। फिर आधार के साथ CSC या सूचीबद्ध अस्पताल में मुफ़्त कार्ड बनवाएं।',
    ],
    [
      'क्या आवेदन के लिए कोई फीस देनी होती है?',
      'नहीं। सरकारी योजनाओं में आवेदन मुफ़्त है। किसी एजेंट को पैसे न दें और अपना OTP किसी को न बताएं।',
    ],
  ],
  mr: [
    [
      'पीएम-किसानमध्ये किती पैसे मिळतात?',
      'वर्षाला ₹6,000, ₹2,000 च्या तीन हप्त्यांमध्ये, थेट शेतकऱ्याच्या बँक खात्यात.',
    ],
    [
      'आयुष्मान कार्ड कसे काढायचे?',
      'beneficiary.nha.gov.in वर नाव तपासा किंवा 14555 वर कॉल करा. नंतर आधारसह CSC किंवा सूचीबद्ध रुग्णालयात मोफत कार्ड काढा.',
    ],
    [
      'अर्जासाठी काही शुल्क भरावे लागते का?',
      'नाही. सरकारी योजनांसाठी अर्ज मोफत आहे. कोणत्याही एजंटला पैसे देऊ नका आणि तुमचा OTP कोणालाही सांगू नका.',
    ],
  ],
  ta: [
    [
      'பிஎம்-கிசானில் எவ்வளவு பணம் கிடைக்கும்?',
      'ஆண்டுக்கு ₹6,000, ₹2,000 வீதம் மூன்று தவணைகளாக, நேரடியாக விவசாயியின் வங்கிக் கணக்கில்.',
    ],
    [
      'ஆயுஷ்மான் அட்டை எப்படிப் பெறுவது?',
      'beneficiary.nha.gov.in-ல் பெயரைச் சரிபார்க்கவும் அல்லது 14555-ஐ அழைக்கவும். பின்னர் ஆதாருடன் CSC அல்லது பட்டியலிடப்பட்ட மருத்துவமனையில் இலவசமாக அட்டை பெறவும்.',
    ],
    [
      'விண்ணப்பிக்கக் கட்டணம் உண்டா?',
      'இல்லை. அரசு திட்டங்களுக்கு விண்ணப்பிப்பது இலவசம். எந்த முகவருக்கும் பணம் கொடுக்காதீர்கள்; உங்கள் OTP-ஐ யாரிடமும் சொல்லாதீர்கள்.',
    ],
  ],
};

const FAQ_SOURCES = [
  mockSource('pm-kisan', 'Benefits'),
  mockSource('ayushman-bharat-pmjay', 'How to apply'),
  mockSource('pm-kisan', 'How to apply'),
];

export function mockTopFaq(language: LanguageCode): FaqItem[] {
  return FAQ_TEXT[language].map(([question, answer], index) => ({
    id: `faq-${index + 1}`,
    question,
    answer,
    sources: [FAQ_SOURCES[index]],
  }));
}
