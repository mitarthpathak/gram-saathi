import type { LanguageCode } from '@gram-saathi/shared';
import type { ReplyScript } from './language';

interface Messages {
  /** Shown with every answer. Static on purpose: safety text must never depend on the model. */
  fraudWarning: string;
  /** Friendly response to an exact greeting; contains no scheme facts. */
  greeting: string;
  /** SMS version of `greeting`. */
  greetingSms: string;
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
    greeting: 'Hi! What would you like to know about a government scheme?',
    greetingSms: 'Hi! What would you like to know?',
    notFound:
      'Sorry, I could not find this in the official scheme documents I have, so I will not guess. Please confirm at your nearest CSC or gram panchayat office.',
    notFoundSms:
      'No official info found for your question. Please confirm at your nearest CSC or gram panchayat office.',
  },
  hi: {
    fraudWarning:
      'धोखाधड़ी से सावधान: कोई भी सरकारी योजना आपसे पैसे या OTP नहीं मांगती। किसी को पैसे न दें और अपना OTP या बैंक PIN कभी न बताएं। आवेदन केवल .gov.in वेबसाइट या नज़दीकी CSC केंद्र पर करें।',
    // TODO(review-native): have a native Hindi speaker review this greeting.
    greeting: 'नमस्ते! सरकारी योजना के बारे में क्या जानना चाहेंगे?',
    greetingSms: 'नमस्ते! सरकारी योजना के बारे में पूछें।',
    notFound:
      'माफ़ कीजिए, यह जानकारी मेरे पास मौजूद आधिकारिक योजना दस्तावेज़ों में नहीं मिली, इसलिए अंदाज़े से जवाब देना ठीक नहीं होगा। कृपया नज़दीकी CSC केंद्र या ग्राम पंचायत कार्यालय में पुष्टि करें।',
    notFoundSms:
      'आपके सवाल की आधिकारिक जानकारी नहीं मिली। कृपया नज़दीकी CSC या ग्राम पंचायत में पुष्टि करें।',
  },
  mr: {
    fraudWarning:
      'फसवणुकीपासून सावध रहा: कोणतीही सरकारी योजना तुमच्याकडे पैसे किंवा OTP मागत नाही. कोणालाही पैसे देऊ नका आणि तुमचा OTP किंवा बँक PIN कधीही सांगू नका. अर्ज फक्त .gov.in संकेतस्थळावर किंवा जवळच्या CSC केंद्रातच करा.',
    // TODO(review-native): have a native Marathi speaker review this greeting.
    greeting: 'नमस्कार! सरकारी योजनेबद्दल काय जाणून घ्यायचे आहे?',
    greetingSms: 'नमस्कार! सरकारी योजनेबद्दल विचारा.',
    notFound:
      'माफ करा, ही माहिती माझ्याकडील अधिकृत योजना कागदपत्रांमध्ये सापडली नाही, म्हणून मी अंदाज लावणार नाही. कृपया जवळच्या CSC केंद्रात किंवा ग्रामपंचायत कार्यालयात खात्री करा.',
    notFoundSms:
      'तुमच्या प्रश्नाची अधिकृत माहिती सापडली नाही. कृपया जवळच्या CSC किंवा ग्रामपंचायतीत खात्री करा.',
  },
  ta: {
    fraudWarning:
      'மோசடி எச்சரிக்கை: எந்த அரசுத் திட்டமும் உங்களிடம் பணமோ OTP-யோ கேட்காது. யாருக்கும் பணம் கொடுக்காதீர்கள்; உங்கள் OTP அல்லது வங்கி PIN-ஐ ஒருபோதும் பகிராதீர்கள். .gov.in இணையதளங்கள் அல்லது அருகிலுள்ள பொது சேவை மையத்தில் (CSC) மட்டுமே விண்ணப்பியுங்கள்.',
    // TODO(review-native): have a native Tamil speaker review this greeting.
    greeting: 'வணக்கம்! அரசுத் திட்டம் பற்றி என்ன தெரிந்துகொள்ள விரும்புகிறீர்கள்?',
    greetingSms: 'வணக்கம்! அரசுத் திட்டம் பற்றி கேளுங்கள்.',
    notFound:
      'மன்னிக்கவும், என்னிடம் உள்ள அதிகாரப்பூர்வ திட்ட ஆவணங்களில் இந்தத் தகவல் இல்லை; அதனால் நான் ஊகித்துச் சொல்ல மாட்டேன். அருகிலுள்ள பொது சேவை மையம் (CSC) அல்லது கிராம பஞ்சாயத்து அலுவலகத்தில் உறுதிப்படுத்திக்கொள்ளுங்கள்.',
    notFoundSms:
      'உங்கள் கேள்விக்கு அதிகாரப்பூர்வ தகவல் கிடைக்கவில்லை. அருகிலுள்ள CSC அல்லது கிராம பஞ்சாயத்தில் உறுதிப்படுத்துங்கள்.',
  },
};

/** Natural Latin-script wording for users who type Hindi, Marathi or Tamil in Roman letters. */
const ROMAN_MESSAGES: Partial<Record<LanguageCode, Messages>> = {
  hi: {
    fraudWarning:
      'Dhokhadhadi se savdhan: koi bhi sarkari yojana aapse paise ya OTP nahi maangti. Kisi ko paise na dein aur apna OTP ya bank PIN kabhi na batayen. Aavedan sirf .gov.in website ya najdeeki CSC par karein.',
    greeting: 'Namaste! Sarkari yojana ke baare mein kya jaanana chahenge?',
    greetingSms: 'Namaste! Sarkari yojana ke baare mein poochhein.',
    notFound:
      'Maaf kijiye, yeh jaankari mere paas maujood adhikarik yojana dastavezon mein nahi mili, isliye main andaza nahi lagaunga. Kripya najdeeki CSC ya gram panchayat mein poochhein.',
    notFoundSms:
      'Aapke sawaal ki adhikarik jaankari nahi mili. Kripya najdeeki CSC ya gram panchayat mein poochhein.',
  },
  mr: {
    fraudWarning:
      'Fasavnukipasun savadh raha: kontihi sarkari yojana tumchyakade paise kiwa OTP magat nahi. Konalahi paise deu naka; tumcha OTP kiwa bank PIN sangu naka. Arj fakt .gov.in websitevar kiwa javalchya CSC kendraat kara.',
    greeting: 'Namaskar! Sarkari yojanebaddal kay janun ghyayche aahe?',
    greetingSms: 'Namaskar! Sarkari yojanebaddal vichara.',
    notFound:
      'Maaf kara, hi mahiti majhyakadil adhikrut yojana kagadpatrant sapadli nahi, mhanun mi andaj lavnar nahi. Krupaya javalchya CSC kendraat kiwa gram panchayat karyalayat vichara.',
    notFoundSms:
      'Tumchya prashnachi adhikrut mahiti sapadli nahi. Krupaya javalchya CSC kiwa gram panchayat karyalayat vichara.',
  },
  ta: {
    fraudWarning:
      'Mosadi echarikkai: entha arasu thittamum ungalidam panamo OTP-yo ketkathu. Yaarukkum panam kodukkadheergal; ungal OTP allathu bank PIN-ai pagiradheergal. .gov.in website allathu arugilulla CSC-il mattume vinnappiyungal.',
    greeting: 'Vanakkam! Arasu thittam patri enna therindhukolla virumbugireergal?',
    greetingSms: 'Vanakkam! Arasu thittam patri kelungal.',
    notFound:
      'Mannikkavum, ennidam ulla adhikarappoorva thitta aavanangalil indha thagaval illai; athanaal naan oogithu solla maatten. Arugilulla CSC allathu gram panchayat aluvalagathil kelungal.',
    notFoundSms:
      'Ungal kelvikku adhikarappoorva thagaval kidaikkavillai. Arugilulla CSC allathu gram panchayat-il kelungal.',
  },
};

function messagesFor(language: LanguageCode, script?: ReplyScript): Messages {
  return script === 'Latin'
    ? (ROMAN_MESSAGES[language] ?? MESSAGES[language])
    : MESSAGES[language];
}

const GREETING_PHRASES = new Set([
  'hi',
  'hi there',
  'hello',
  'hello there',
  'hey',
  'hey there',
  'good morning',
  'good afternoon',
  'good evening',
  'namaste',
  'namaskar',
  'namaskaar',
  'namaskara',
  'pranam',
  'vanakkam',
  'vanakkangal',
  'khamma ghani',
  'johar',
  'ram ram sa',
  'radhe radhe',
  'नमस्ते',
  'नमस्कार',
  'प्रणाम',
  'राम राम',
  'राधे राधे',
  'खम्मा घणी',
  'हेलो',
  'हैलो',
  'हाय',
  'வணக்கம்',
  'வணக்கங்கள்',
  'ஹலோ',
  'ஹாய்',
]);

export function getGreetingReply(
  text: string,
  language: LanguageCode,
  script?: ReplyScript,
): { answer: string; smsText: string } | undefined {
  const normalized = text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!GREETING_PHRASES.has(normalized)) return undefined;

  const messages = messagesFor(language, script);
  return { answer: messages.greeting, smsText: messages.greetingSms };
}

const WHERE_FROM_REPLIES: Record<LanguageCode, { native: string; roman: string }> = {
  en: {
    native: "I'm Gram Saathi, here to help with government scheme information. What would you like to know?",
    roman: "I'm Gram Saathi, here to help with government scheme information. What would you like to know?",
  },
  hi: {
    native: 'मैं ग्राम साथी हूँ। सरकारी योजनाओं की जानकारी में मदद करता हूँ। आप किस योजना के बारे में पूछना चाहेंगे?',
    roman: 'Main Gram Saathi hoon. Sarkari yojanaon ki jaankari mein madad karta hoon. Aap kis yojana ke baare mein poochhna chahenge?',
  },
  mr: {
    native: 'मी ग्राम साथी आहे. सरकारी योजनांची माहिती शोधण्यात मी मदत करतो. तुम्हाला कोणत्या योजनेबद्दल जाणून घ्यायचे आहे?',
    roman: 'Mi Gram Saathi aahe. Sarkari yojananchi mahiti shodhayla mi madat karto. Tumhala kontya yojanebaddal vicharayche aahe?',
  },
  ta: {
    native: 'நான் கிராம் சாத்தி. அரசு திட்டங்கள் பற்றிய தகவலுக்கு உதவுகிறேன். எந்தத் திட்டத்தைப் பற்றி தெரிந்துகொள்ள விரும்புகிறீர்கள்?',
    roman: 'Naan Gram Saathi. Arasu thittangal patriya thagavalukku udhavugiren. Endha thittathai patri therindhukolla virumbugireergal?',
  },
};

/** Deterministic small-talk response for common identity/location questions. */
export function getSmallTalkReply(
  text: string,
  language: LanguageCode,
  script?: ReplyScript,
): { answer: string; smsText: string } | undefined {
  const normalized = text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[?!.,।]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const asksWhereFrom =
    /\bwhere are you from\b/.test(normalized) ||
    /\b(?:kaha|kahaan|kahan)\s+se\s+(?:ho|hain|hai)\b/.test(normalized) ||
    /\b(?:kaha|kahaan|kahan)\s+ke\s+ho\b/.test(normalized) ||
    /कहाँ\s+से\s+(?:हो|हैं|है)/.test(normalized) ||
    /आप\s+कहाँ\s+के\s+हो/.test(normalized);
  if (!asksWhereFrom) return undefined;

  const reply = WHERE_FROM_REPLIES[language];
  const answer = script === 'Latin' ? reply.roman : reply.native;
  return { answer, smsText: answer };
}

export function getMessage(
  language: LanguageCode,
  key: keyof Messages,
  script?: ReplyScript,
): string {
  return messagesFor(language, script)[key];
}

export function getFraudWarning(language: LanguageCode, script?: ReplyScript): string {
  return getMessage(language, 'fraudWarning', script);
}

/**
 * Fixed reply when a conversational answer (smalltalk, clarification, out of scope) would state
 * facts that the conversation never had: the user is asked to repeat instead of getting an
 * unsourced claim.
 */
export const ASK_AGAIN: Record<LanguageCode, string> = {
  en: 'Sorry, I did not understand. Please ask your question about a government scheme again.',
  // TODO(review-native): have a native Hindi speaker review this message.
  hi: 'माफ़ कीजिए, मैं समझ नहीं पाया। कृपया सरकारी योजना के बारे में अपना सवाल फिर से पूछें।',
  // TODO(review-native): have a native Marathi speaker review this message.
  mr: 'माफ करा, मला समजले नाही. कृपया सरकारी योजनेबद्दल तुमचा प्रश्न पुन्हा विचारा.',
  // TODO(review-native): have a native Tamil speaker review this message.
  ta: 'மன்னிக்கவும், எனக்குப் புரியவில்லை. அரசுத் திட்டம் பற்றிய உங்கள் கேள்வியை மீண்டும் கேளுங்கள்.',
};
