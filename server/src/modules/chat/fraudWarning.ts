import type { LanguageCode } from '@gram-saathi/shared';

// Shown with every answer. Deliberately static: safety text must never depend on the model.
const FRAUD_WARNINGS: Record<LanguageCode, string> = {
  en: 'Beware of fraud: applying for government schemes is free. Never share your OTP or bank PIN with anyone. Use only .gov.in websites or your nearest CSC.',
  hi: 'धोखाधड़ी से सावधान: सरकारी योजनाओं में आवेदन मुफ़्त है। अपना OTP या बैंक PIN किसी को न बताएं। केवल .gov.in वेबसाइट या नज़दीकी CSC केंद्र का ही उपयोग करें।',
  mr: 'फसवणुकीपासून सावध रहा: सरकारी योजनांसाठी अर्ज मोफत आहे. तुमचा OTP किंवा बँक PIN कोणालाही सांगू नका. फक्त .gov.in संकेतस्थळ किंवा जवळच्या CSC केंद्राचाच वापर करा.',
  ta: 'மோசடி எச்சரிக்கை: அரசு திட்டங்களுக்கு விண்ணப்பிக்க கட்டணம் இல்லை. உங்கள் OTP அல்லது வங்கி PIN-ஐ யாரிடமும் பகிர வேண்டாம். .gov.in இணையதளங்கள் அல்லது அருகிலுள்ள பொது சேவை மையத்தை (CSC) மட்டுமே பயன்படுத்துங்கள்.',
};

export function getFraudWarning(language: LanguageCode): string {
  return FRAUD_WARNINGS[language];
}
