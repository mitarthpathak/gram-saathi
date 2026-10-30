import type { LanguageCode } from '@gram-saathi/shared';

interface Messages {
  /** Shown with every answer. Static on purpose: safety text must never depend on the model. */
  fraudWarning: string;
  /** Answer when the documents do not cover the question: honest, and says where to confirm. */
  notFound: string;
  /** SMS version of `notFound`. */
  notFoundSms: string;
}

/**
 * Fixed, reviewed text per language. To add a language, add it to `LanguageCode` (contract) and
 * to lib/languages.ts, then add an entry here: the compiler points at every missing translation.
 */
export const MESSAGES: Record<LanguageCode, Messages> = {
  en: {
    fraudWarning:
      'Beware of fraud: no government scheme ever asks you for money or an OTP. Do not pay anyone, and never share your OTP or bank PIN. Apply only on .gov.in websites or at your nearest CSC.',
    notFound:
      'Sorry, I could not find this in the official scheme documents I have, so I will not guess. Please confirm at your nearest CSC or gram panchayat office.',
    notFoundSms:
      'No official info found for your question. Please confirm at your nearest CSC or gram panchayat office.',
  },
  hi: {
    fraudWarning:
      'धोखाधड़ी से सावधान: कोई भी सरकारी योजना आपसे पैसे या OTP नहीं मांगती। किसी को पैसे न दें और अपना OTP या बैंक PIN कभी न बताएं। आवेदन केवल .gov.in वेबसाइट या नज़दीकी CSC केंद्र पर करें।',
    notFound:
      'माफ़ कीजिए, यह जानकारी मेरे पास मौजूद आधिकारिक योजना दस्तावेज़ों में नहीं मिली, इसलिए अंदाज़े से जवाब देना ठीक नहीं होगा। कृपया नज़दीकी CSC केंद्र या ग्राम पंचायत कार्यालय में पुष्टि करें।',
    notFoundSms:
      'आपके सवाल की आधिकारिक जानकारी नहीं मिली। कृपया नज़दीकी CSC या ग्राम पंचायत में पुष्टि करें।',
  },
  mr: {
    fraudWarning:
      'फसवणुकीपासून सावध रहा: कोणतीही सरकारी योजना तुमच्याकडे पैसे किंवा OTP मागत नाही. कोणालाही पैसे देऊ नका आणि तुमचा OTP किंवा बँक PIN कधीही सांगू नका. अर्ज फक्त .gov.in संकेतस्थळावर किंवा जवळच्या CSC केंद्रातच करा.',
    notFound:
      'माफ करा, ही माहिती माझ्याकडील अधिकृत योजना कागदपत्रांमध्ये सापडली नाही, म्हणून मी अंदाज लावणार नाही. कृपया जवळच्या CSC केंद्रात किंवा ग्रामपंचायत कार्यालयात खात्री करा.',
    notFoundSms:
      'तुमच्या प्रश्नाची अधिकृत माहिती सापडली नाही. कृपया जवळच्या CSC किंवा ग्रामपंचायतीत खात्री करा.',
  },
  ta: {
    fraudWarning:
      'மோசடி எச்சரிக்கை: எந்த அரசுத் திட்டமும் உங்களிடம் பணமோ OTP-யோ கேட்காது. யாருக்கும் பணம் கொடுக்காதீர்கள்; உங்கள் OTP அல்லது வங்கி PIN-ஐ ஒருபோதும் பகிராதீர்கள். .gov.in இணையதளங்கள் அல்லது அருகிலுள்ள பொது சேவை மையத்தில் (CSC) மட்டுமே விண்ணப்பியுங்கள்.',
    notFound:
      'மன்னிக்கவும், என்னிடம் உள்ள அதிகாரப்பூர்வ திட்ட ஆவணங்களில் இந்தத் தகவல் இல்லை; அதனால் நான் ஊகித்துச் சொல்ல மாட்டேன். அருகிலுள்ள பொது சேவை மையம் (CSC) அல்லது கிராம பஞ்சாயத்து அலுவலகத்தில் உறுதிப்படுத்திக்கொள்ளுங்கள்.',
    notFoundSms:
      'உங்கள் கேள்விக்கு அதிகாரப்பூர்வ தகவல் கிடைக்கவில்லை. அருகிலுள்ள CSC அல்லது கிராம பஞ்சாயத்தில் உறுதிப்படுத்துங்கள்.',
  },
};

export function getFraudWarning(language: LanguageCode): string {
  return MESSAGES[language].fraudWarning;
}
