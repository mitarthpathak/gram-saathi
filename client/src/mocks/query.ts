/**
 * Mock content for the question-answer pipeline: retrieved chunks, answers with SMS versions
 * and fake voice transcripts in Hindi, Marathi, Tamil and English.
 *
 * Identical copies live in server/src/mocks/ and client/src/mocks/ (pure data + pure
 * functions, only shared types imported) so the UI can also run without a server.
 * Edit both copies together; it is throwaway demo data.
 */
import type { LanguageCode, RetrievedChunk, Source } from '@gram-saathi/shared';

type Topic = 'pmKisan' | 'pmJay';

const PM_KISAN = { schemeId: 'pm-kisan', schemeName: 'PM-KISAN Samman Nidhi' };
const PM_JAY = { schemeId: 'ayushman-bharat-pmjay', schemeName: 'Ayushman Bharat PM-JAY' };

/** Same wording as the sample documents in data/schemes/. */
const CHUNKS: Record<Topic, RetrievedChunk[]> = {
  pmKisan: [
    {
      ...PM_KISAN,
      section: 'Benefits',
      score: 0.92,
      text: 'Eligible landholding farmer families get ₹6,000 per year, paid in three equal instalments of ₹2,000 directly into their Aadhaar-seeded bank account (DBT).',
    },
    {
      ...PM_KISAN,
      section: 'Eligibility',
      score: 0.86,
      text: 'All landholding farmer families whose names are in the land records are eligible. Excluded: institutional landholders, families with an income-tax payer, serving or retired government employees (except Group D / MTS), registered professionals such as doctors, engineers and lawyers, and pensioners getting ₹10,000 or more per month.',
    },
    {
      ...PM_KISAN,
      section: 'How to apply',
      score: 0.79,
      text: 'Registration is free. Apply at pmkisan.gov.in (New Farmer Registration), at a Common Service Centre (CSC) or through the local Patwari / revenue officer. eKYC with Aadhaar is mandatory to receive instalments.',
    },
  ],
  pmJay: [
    {
      ...PM_JAY,
      section: 'Benefits',
      score: 0.9,
      text: 'PM-JAY gives health cover of up to ₹5 lakh per family per year for secondary and tertiary hospital care. Treatment is cashless and paperless at empanelled public and private hospitals.',
    },
    {
      ...PM_JAY,
      section: 'Eligibility',
      score: 0.83,
      text: 'Rural families are covered under the SECC 2011 deprivation criteria and urban families under occupational criteria. All senior citizens aged 70 and above are covered irrespective of income, as are ASHA and Anganwadi workers and their families.',
    },
    {
      ...PM_JAY,
      section: 'How to apply',
      score: 0.75,
      text: 'Check eligibility at beneficiary.nha.gov.in or call 14555. The Ayushman card is made free of cost with Aadhaar eKYC at a CSC, at an empanelled hospital (Ayushman Mitra desk) or on the Ayushman app.',
    },
  ],
};

interface MockAnswer {
  answer: string;
  /** Hand-written SMS version. English avoids "₹" because it is not in the GSM-7 alphabet. */
  sms: string;
}

const ANSWERS: Record<Topic | 'notFound', Record<LanguageCode, MockAnswer>> = {
  pmKisan: {
    en: {
      answer:
        'Under PM-KISAN, eligible farmer families get ₹6,000 a year, paid as three instalments of ₹2,000 straight into their bank account. Your name must be in the land records and Aadhaar eKYC is required. Families with an income-tax payer or a government employee cannot apply. Registration is free at pmkisan.gov.in or your nearest CSC.',
      sms: 'PM-KISAN: Rs 6000/year in 3 instalments of Rs 2000 to your bank. Need land record + Aadhaar eKYC. Register free at pmkisan.gov.in or CSC.',
    },
    hi: {
      answer:
        'पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में सीधे बैंक खाते में आते हैं। ज़मीन के रिकॉर्ड में आपका नाम होना चाहिए और आधार से eKYC ज़रूरी है। जिन परिवारों में कोई आयकर देता है या सरकारी कर्मचारी है, वे आवेदन नहीं कर सकते। पंजीकरण pmkisan.gov.in पर या नज़दीकी CSC केंद्र पर मुफ़्त है।',
      sms: 'पीएम-किसान: साल में ₹6000, ₹2000 की 3 किस्तें सीधे बैंक में। ज़मीन रिकॉर्ड व आधार eKYC ज़रूरी। मुफ़्त पंजीकरण: pmkisan.gov.in या CSC',
    },
    mr: {
      answer:
        'पीएम-किसान योजनेत पात्र शेतकरी कुटुंबांना दरवर्षी ₹6,000 मिळतात, जे ₹2,000 च्या तीन हप्त्यांमध्ये थेट बँक खात्यात जमा होतात. जमिनीच्या नोंदीत तुमचे नाव असणे आवश्यक आहे आणि आधार eKYC बंधनकारक आहे. ज्या कुटुंबात कोणी आयकर भरतो किंवा सरकारी कर्मचारी आहे, त्यांना अर्ज करता येत नाही. नोंदणी pmkisan.gov.in वर किंवा जवळच्या CSC केंद्रावर मोफत आहे.',
      sms: 'पीएम-किसान: वर्षाला ₹6000, ₹2000 चे 3 हप्ते थेट बँकेत. जमीन नोंद व आधार eKYC आवश्यक. मोफत नोंदणी: pmkisan.gov.in किंवा CSC',
    },
    ta: {
      answer:
        'பிஎம்-கிசான் திட்டத்தில் தகுதியுள்ள விவசாயக் குடும்பங்களுக்கு ஆண்டுக்கு ₹6,000 கிடைக்கும். இது ₹2,000 வீதம் மூன்று தவணைகளாக நேரடியாக வங்கிக் கணக்கில் செலுத்தப்படும். நில ஆவணங்களில் உங்கள் பெயர் இருக்க வேண்டும்; ஆதார் eKYC கட்டாயம். குடும்பத்தில் யாராவது வருமான வரி செலுத்தினால் அல்லது அரசு ஊழியராக இருந்தால் விண்ணப்பிக்க முடியாது. pmkisan.gov.in அல்லது அருகிலுள்ள CSC மையத்தில் இலவசமாகப் பதிவு செய்யலாம்.',
      sms: 'பிஎம்-கிசான்: ஆண்டுக்கு ₹6000, 3 தவணையாக வங்கியில். நில ஆவணம், ஆதார் eKYC அவசியம். இலவசப் பதிவு: pmkisan.gov.in / CSC',
    },
  },
  pmJay: {
    en: {
      answer:
        'Ayushman Bharat PM-JAY gives free hospital treatment of up to ₹5 lakh per family per year at government and empanelled private hospitals. It is cashless: you pay nothing at the hospital. Eligibility is based on SECC 2011 data, and all senior citizens aged 70 or above are covered. Check your name at beneficiary.nha.gov.in or call 14555, then get your free Ayushman card at a CSC or hospital.',
      sms: 'PM-JAY: free hospital care up to Rs 5 lakh/family/year, cashless. Check name: beneficiary.nha.gov.in or call 14555. Ayushman card is free at CSC.',
    },
    hi: {
      answer:
        'आयुष्मान भारत पीएम-जय में हर परिवार को हर साल ₹5 लाख तक का मुफ़्त इलाज सरकारी और सूचीबद्ध निजी अस्पतालों में मिलता है। इलाज कैशलेस है, अस्पताल में कोई पैसा नहीं देना होता। पात्रता SECC 2011 के आंकड़ों से तय होती है, और 70 साल या उससे ज़्यादा उम्र के सभी बुज़ुर्ग शामिल हैं। beneficiary.nha.gov.in पर अपना नाम देखें या 14555 पर कॉल करें, फिर CSC या अस्पताल से मुफ़्त आयुष्मान कार्ड बनवाएं।',
      sms: 'आयुष्मान भारत: हर परिवार को साल में ₹5 लाख तक मुफ़्त इलाज। नाम देखें: beneficiary.nha.gov.in या कॉल 14555। कार्ड CSC पर मुफ़्त।',
    },
    mr: {
      answer:
        'आयुष्मान भारत पीएम-जय अंतर्गत प्रत्येक कुटुंबाला दरवर्षी ₹5 लाखांपर्यंत मोफत उपचार सरकारी आणि सूचीबद्ध खासगी रुग्णालयांमध्ये मिळतात. उपचार कॅशलेस आहेत, रुग्णालयात पैसे भरावे लागत नाहीत. पात्रता SECC 2011 च्या माहितीवर ठरते आणि 70 वर्षे किंवा त्याहून अधिक वयाचे सर्व ज्येष्ठ नागरिक पात्र आहेत. beneficiary.nha.gov.in वर तुमचे नाव तपासा किंवा 14555 वर कॉल करा, नंतर CSC किंवा रुग्णालयातून मोफत आयुष्मान कार्ड काढा.',
      sms: 'आयुष्मान भारत: प्रत्येक कुटुंबाला वर्षाला ₹5 लाखांपर्यंत मोफत उपचार. नाव तपासा: beneficiary.nha.gov.in किंवा 14555. कार्ड CSC वर मोफत.',
    },
    ta: {
      answer:
        'ஆயுஷ்மான் பாரத் பிஎம்-ஜெய் திட்டத்தில் ஒவ்வொரு குடும்பத்துக்கும் ஆண்டுக்கு ₹5 லட்சம் வரை இலவச மருத்துவமனை சிகிச்சை, அரசு மற்றும் பட்டியலிடப்பட்ட தனியார் மருத்துவமனைகளில் கிடைக்கும். சிகிச்சை பணமில்லாதது; மருத்துவமனையில் எதுவும் செலுத்த வேண்டியதில்லை. தகுதி SECC 2011 தரவின் அடிப்படையில் முடிவாகிறது; 70 வயது அல்லது அதற்கு மேற்பட்ட அனைத்து மூத்த குடிமக்களும் தகுதியானவர்கள். beneficiary.nha.gov.in-ல் உங்கள் பெயரைச் சரிபார்க்கவும் அல்லது 14555-ஐ அழைக்கவும்; பின்னர் CSC அல்லது மருத்துவமனையில் இலவச ஆயுஷ்மான் அட்டை பெறவும்.',
      sms: 'ஆயுஷ்மான் பாரத்: குடும்பத்துக்கு ஆண்டுக்கு ₹5 லட்சம் வரை இலவச சிகிச்சை. பெயர் சரிபார்க்க: beneficiary.nha.gov.in / 14555',
    },
  },
  notFound: {
    en: {
      answer:
        'Sorry, I could not find this in the official scheme documents I have, so I will not guess. Please ask at your Gram Panchayat office or nearest CSC.',
      sms: 'No official info found for your question. Please ask at your Gram Panchayat or nearest CSC.',
    },
    hi: {
      answer:
        'माफ़ कीजिए, यह जानकारी मेरे पास मौजूद आधिकारिक योजना दस्तावेज़ों में नहीं मिली, इसलिए अंदाज़े से जवाब देना ठीक नहीं होगा। कृपया अपनी ग्राम पंचायत या नज़दीकी CSC केंद्र पर पूछें।',
      sms: 'आपके सवाल की आधिकारिक जानकारी नहीं मिली। कृपया ग्राम पंचायत या नज़दीकी CSC पर पूछें।',
    },
    mr: {
      answer:
        'माफ करा, ही माहिती माझ्याकडील अधिकृत योजना कागदपत्रांमध्ये सापडली नाही, म्हणून मी अंदाज लावणार नाही. कृपया तुमच्या ग्रामपंचायत कार्यालयात किंवा जवळच्या CSC केंद्रात विचारा.',
      sms: 'तुमच्या प्रश्नाची अधिकृत माहिती सापडली नाही. कृपया ग्रामपंचायत किंवा जवळच्या CSC मध्ये विचारा.',
    },
    ta: {
      answer:
        'மன்னிக்கவும், என்னிடம் உள்ள அதிகாரப்பூர்வ திட்ட ஆவணங்களில் இந்தத் தகவல் இல்லை; அதனால் நான் ஊகித்துச் சொல்ல மாட்டேன். உங்கள் கிராம பஞ்சாயத்து அலுவலகம் அல்லது அருகிலுள்ள CSC மையத்தில் கேளுங்கள்.',
      sms: 'உங்கள் கேள்விக்கு அதிகாரப்பூர்வ தகவல் கிடைக்கவில்லை. கிராம பஞ்சாயத்து அல்லது CSC-ல் கேளுங்கள்.',
    },
  },
};

/** Canned "speech-to-text" results; the voice mock alternates between the two topics. */
const TRANSCRIPTS: Record<LanguageCode, string[]> = {
  en: [
    'How much money does PM-KISAN give a farmer every year?',
    'How much free hospital treatment does the Ayushman card cover?',
  ],
  hi: [
    'पीएम किसान योजना में साल में कितना पैसा मिलता है?',
    'आयुष्मान कार्ड से कितने रुपये तक का इलाज मुफ़्त होता है?',
  ],
  mr: [
    'पीएम किसान योजनेत वर्षाला किती पैसे मिळतात?',
    'आयुष्मान कार्डवर किती रुपयांपर्यंत मोफत उपचार मिळतात?',
  ],
  ta: [
    'பிஎம் கிசான் திட்டத்தில் ஆண்டுக்கு எவ்வளவு பணம் கிடைக்கும்?',
    'ஆயுஷ்மான் அட்டையில் எவ்வளவு வரை இலவச சிகிச்சை கிடைக்கும்?',
  ],
};

/** Keyword routing that stands in for retrieval. Checked in order. */
const TOPIC_KEYWORDS: [Topic, RegExp][] = [
  [
    'pmJay',
    /ayushman|आयुष्मान|ஆயுஷ்மான்|pm-?jay|hospital|अस्पताल|रुग्णालय|दवाखान|மருத்துவ|health|इलाज|उपचार|சிகிச்சை|treatment/i,
  ],
  ['pmKisan', /kisan|किसान|शेतकरी|கிசான்|விவசாய|farmer|किस्त|हप्ता|தவணை|instal/i],
];

/** Script-based guess: Tamil script → ta, Devanagari → hi or mr (Marathi marker words), else the hint. */
export function mockDetectLanguage(text: string, hint?: LanguageCode): LanguageCode {
  if (/[஀-௿]/.test(text)) return 'ta';
  if (/[ऀ-ॿ]/.test(text)) {
    return /ळ|आहे|काय|मला|किती|कसे|नाही|आणि|योजनेत/.test(text) ? 'mr' : 'hi';
  }
  // Latin script: English, or romanised Hindi/Marathi/Tamil typed by someone using that UI language.
  return hint ?? 'en';
}

export function mockSearchSchemes(query: string, topK: number): RetrievedChunk[] {
  const topic = TOPIC_KEYWORDS.find(([, pattern]) => pattern.test(query))?.[0];
  return topic ? CHUNKS[topic].slice(0, topK) : [];
}

export function mockGenerateAnswer(
  chunks: RetrievedChunk[],
  language: LanguageCode,
): { answer: string; smsText: string; notFound: boolean } {
  const schemeId = chunks[0]?.schemeId;
  const topic: Topic | 'notFound' =
    schemeId === PM_KISAN.schemeId
      ? 'pmKisan'
      : schemeId === PM_JAY.schemeId
        ? 'pmJay'
        : 'notFound';
  const { answer, sms } = ANSWERS[topic][language];
  return { answer, smsText: sms, notFound: topic === 'notFound' };
}

let voiceTurn = 0;

/** Pretends to transcribe audio: alternates between two canned questions in the given language. */
export function mockTranscribe(language: LanguageCode = 'hi'): string {
  const options = TRANSCRIPTS[language];
  const transcript = options[voiceTurn % options.length];
  voiceTurn += 1;
  return transcript;
}

/** A mock chunk as a citation, looked up by scheme and section (used by the FAQ mocks). */
export function mockSource(schemeId: string, section: string): Source {
  const chunk = Object.values(CHUNKS)
    .flat()
    .find((candidate) => candidate.schemeId === schemeId && candidate.section === section);
  if (!chunk) throw new Error(`No mock chunk for ${schemeId} / ${section}`);
  return {
    schemeId: chunk.schemeId,
    schemeName: chunk.schemeName,
    section: chunk.section,
    snippet: chunk.text,
  };
}
