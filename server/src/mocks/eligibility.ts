/**
 * Mock eligibility flow: four localized questions and toy rules for three schemes.
 *
 * Identical copies live in server/src/mocks/ and client/src/mocks/ (pure data + pure
 * functions, only shared types imported). Edit both copies together.
 */
import type { EligibilityQuestionType, EligibilityResult, LanguageCode } from '@gram-saathi/shared';

type Localized = Record<LanguageCode, string>;

export interface MockQuestion {
  id: string;
  type: EligibilityQuestionType;
  text: Localized;
  /** "choice" only: canonical values with labels per language (the client sends a label). */
  options?: { value: string; label: Localized }[];
  /** "number" only: inclusive range. */
  min?: number;
  max?: number;
}

/** Canonical answers by question id: numbers, booleans and choice values (not labels). */
export type MockAnswers = Record<string, number | boolean | string>;

export const MOCK_ELIGIBILITY_QUESTIONS: MockQuestion[] = [
  {
    id: 'age',
    type: 'number',
    min: 0,
    max: 120,
    text: {
      en: 'How old are you? (in years)',
      hi: 'आपकी उम्र कितनी है? (साल में)',
      mr: 'तुमचे वय किती आहे? (वर्षांमध्ये)',
      ta: 'உங்கள் வயது என்ன? (ஆண்டுகளில்)',
    },
  },
  {
    id: 'occupation',
    type: 'choice',
    text: {
      en: 'What work do you mainly do?',
      hi: 'आप मुख्य रूप से क्या काम करते हैं?',
      mr: 'तुम्ही मुख्यतः कोणते काम करता?',
      ta: 'நீங்கள் முக்கியமாக என்ன வேலை செய்கிறீர்கள்?',
    },
    options: [
      { value: 'farmer', label: { en: 'Farmer', hi: 'किसान', mr: 'शेतकरी', ta: 'விவசாயி' } },
      {
        value: 'labourer',
        label: {
          en: 'Daily-wage labourer',
          hi: 'दिहाड़ी मज़दूर',
          mr: 'रोजंदारी मजूर',
          ta: 'தினக்கூலித் தொழிலாளி',
        },
      },
      {
        value: 'asha',
        label: {
          en: 'ASHA / Anganwadi worker',
          hi: 'आशा / आंगनवाड़ी कार्यकर्ता',
          mr: 'आशा / अंगणवाडी सेविका',
          ta: 'ஆஷா / அங்கன்வாடி பணியாளர்',
        },
      },
      { value: 'other', label: { en: 'Other', hi: 'अन्य', mr: 'इतर', ta: 'மற்றவை' } },
    ],
  },
  {
    id: 'ownsLand',
    type: 'boolean',
    text: {
      en: 'Does your family own farmland in its name?',
      hi: 'क्या आपके परिवार के नाम पर खेती की ज़मीन है?',
      mr: 'तुमच्या कुटुंबाच्या नावावर शेतजमीन आहे का?',
      ta: 'உங்கள் குடும்பத்தின் பெயரில் விவசாய நிலம் உள்ளதா?',
    },
  },
  {
    id: 'paysIncomeTax',
    type: 'boolean',
    text: {
      en: 'Does anyone in your family pay income tax?',
      hi: 'क्या आपके परिवार में कोई आयकर (इनकम टैक्स) भरता है?',
      mr: 'तुमच्या कुटुंबातील कोणी आयकर (इन्कम टॅक्स) भरतो का?',
      ta: 'உங்கள் குடும்பத்தில் யாராவது வருமான வரி செலுத்துகிறார்களா?',
    },
  },
];

interface MockScheme {
  schemeId: string;
  name: Localized;
  isEligible: (answers: MockAnswers) => boolean;
  eligibleReason: Localized;
  notEligibleReason: Localized;
}

const age = (answers: MockAnswers) => Number(answers.age);

const SCHEMES: MockScheme[] = [
  {
    schemeId: 'pm-kisan',
    name: {
      en: 'PM-KISAN Samman Nidhi',
      hi: 'पीएम-किसान सम्मान निधि',
      mr: 'पीएम-किसान सन्मान निधी',
      ta: 'பிஎம்-கிசான் சம்மான் நிதி',
    },
    isEligible: (a) => a.ownsLand === true && a.paysIncomeTax === false,
    eligibleReason: {
      en: 'Your family owns farmland and no one pays income tax: you can get ₹6,000 a year.',
      hi: 'आपके परिवार के नाम ज़मीन है और कोई आयकर नहीं भरता: आपको साल में ₹6,000 मिल सकते हैं।',
      mr: 'तुमच्या कुटुंबाच्या नावावर जमीन आहे आणि कोणी आयकर भरत नाही: तुम्हाला वर्षाला ₹6,000 मिळू शकतात.',
      ta: 'உங்கள் குடும்பத்தின் பெயரில் நிலம் உள்ளது, யாரும் வருமான வரி செலுத்தவில்லை: ஆண்டுக்கு ₹6,000 பெறலாம்.',
    },
    notEligibleReason: {
      en: 'Needs farmland in the family’s name and no income-tax payer in the family.',
      hi: 'परिवार के नाम पर खेती की ज़मीन होनी चाहिए और परिवार में कोई आयकरदाता नहीं होना चाहिए।',
      mr: 'कुटुंबाच्या नावावर शेतजमीन असावी आणि कुटुंबात कोणीही आयकरदाता नसावा.',
      ta: 'குடும்பத்தின் பெயரில் விவசாய நிலம் இருக்க வேண்டும்; குடும்பத்தில் யாரும் வருமான வரி செலுத்துபவராக இருக்கக் கூடாது.',
    },
  },
  {
    schemeId: 'ayushman-bharat-pmjay',
    name: {
      en: 'Ayushman Bharat PM-JAY',
      hi: 'आयुष्मान भारत (पीएम-जय)',
      mr: 'आयुष्मान भारत (पीएम-जय)',
      ta: 'ஆயுஷ்மான் பாரத் (பிஎம்-ஜெய்)',
    },
    isEligible: (a) => age(a) >= 70 || a.occupation === 'asha',
    eligibleReason: {
      en: 'People aged 70+ and families of ASHA / Anganwadi workers get free treatment up to ₹5 lakh a year.',
      hi: '70 साल से ऊपर के लोग और आशा / आंगनवाड़ी कार्यकर्ताओं के परिवार ₹5 लाख तक के मुफ़्त इलाज के पात्र हैं।',
      mr: '70 वर्षांवरील नागरिक आणि आशा / अंगणवाडी सेविकांची कुटुंबे ₹5 लाखांपर्यंत मोफत उपचारांसाठी पात्र आहेत.',
      ta: '70 வயதுக்கு மேற்பட்டவர்களும் ஆஷா / அங்கன்வாடி பணியாளர் குடும்பங்களும் ₹5 லட்சம் வரை இலவச சிகிச்சைக்குத் தகுதியானவர்கள்.',
    },
    notEligibleReason: {
      en: 'Depends on the SECC 2011 list: check your name at beneficiary.nha.gov.in or call 14555.',
      hi: 'यह SECC 2011 सूची पर निर्भर है: beneficiary.nha.gov.in पर अपना नाम देखें या 14555 पर कॉल करें।',
      mr: 'हे SECC 2011 यादीवर अवलंबून आहे: beneficiary.nha.gov.in वर तुमचे नाव तपासा किंवा 14555 वर कॉल करा.',
      ta: 'இது SECC 2011 பட்டியலைப் பொறுத்தது: beneficiary.nha.gov.in-ல் உங்கள் பெயரைச் சரிபார்க்கவும் அல்லது 14555-ஐ அழைக்கவும்.',
    },
  },
  {
    schemeId: 'atal-pension-yojana',
    name: {
      en: 'Atal Pension Yojana',
      hi: 'अटल पेंशन योजना',
      mr: 'अटल पेन्शन योजना',
      ta: 'அடல் ஓய்வூதியத் திட்டம்',
    },
    isEligible: (a) => age(a) >= 18 && age(a) <= 40 && a.paysIncomeTax === false,
    eligibleReason: {
      en: 'Aged 18–40 and not an income-tax payer: join at your bank or post office for a pension of ₹1,000–5,000 a month after 60.',
      hi: 'उम्र 18–40 है और आयकर नहीं भरते: बैंक या डाकघर में जुड़ें, 60 साल के बाद ₹1,000–5,000 महीना पेंशन।',
      mr: 'वय 18–40 आहे आणि आयकर भरत नाही: बँक किंवा पोस्ट ऑफिसमध्ये सामील व्हा, 60 वर्षांनंतर दरमहा ₹1,000–5,000 पेन्शन.',
      ta: 'வயது 18–40, வருமான வரி செலுத்துவதில்லை: வங்கி அல்லது அஞ்சலகத்தில் சேருங்கள்; 60 வயதுக்குப் பிறகு மாதம் ₹1,000–5,000 ஓய்வூதியம்.',
    },
    notEligibleReason: {
      en: 'Only for people aged 18–40 who do not pay income tax.',
      hi: 'यह योजना केवल 18–40 साल के उन लोगों के लिए है जो आयकर नहीं भरते।',
      mr: 'ही योजना फक्त 18–40 वयोगटातील आयकर न भरणाऱ्या लोकांसाठी आहे.',
      ta: 'இத்திட்டம் 18–40 வயதுடைய, வருமான வரி செலுத்தாதவர்களுக்கு மட்டுமே.',
    },
  },
];

/** Toy rules for the demo; eligible schemes first. */
export function evaluateMockEligibility(
  answers: MockAnswers,
  language: LanguageCode,
): EligibilityResult[] {
  return SCHEMES.map((scheme) => {
    const eligible = scheme.isEligible(answers);
    return {
      schemeId: scheme.schemeId,
      schemeName: scheme.name[language],
      eligible,
      reason: (eligible ? scheme.eligibleReason : scheme.notEligibleReason)[language],
    };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible));
}
