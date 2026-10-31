import type { LanguageCode } from '@gram-saathi/shared';

/** Words that are common in one language and rare in the other (Devanagari script). */
const MARATHI_WORDS = [
  'आहे',
  'आहेत',
  'काय',
  'मला',
  'किती',
  'कसे',
  'कसा',
  'कशी',
  'नाही',
  'आणि',
  'साठी',
  'मिळते',
  'मिळतात',
  'कुठे',
  'योजनेत',
];
const HINDI_WORDS = [
  'है',
  'हैं',
  'क्या',
  'कैसे',
  'कितना',
  'कितने',
  'मुझे',
  'में',
  'नहीं',
  'और',
  'लिए',
  'मिलता',
  'कहां',
  'कहाँ',
];

/** Romanised words that give away the language of Latin-script text. */
const LATIN_WORDS: Record<'hi' | 'mr' | 'ta' | 'en', string[]> = {
  hi: [
    'hai',
    'hain',
    'kya',
    'kaise',
    'kitna',
    'kitne',
    'kitni',
    'milta',
    'milega',
    'milti',
    'ke',
    'ki',
    'ka',
    'liye',
    'mein',
    'mujhe',
    'kaun',
    'kab',
    'kahan',
    'nahi',
    'chahiye',
    'karna',
    'paisa',
    'paise',
    'sarkari',
    'yojana',
    'batao',
    'bataiye',
  ],
  mr: [
    'ahe',
    'aahe',
    'kay',
    'kasa',
    'kashi',
    'kase',
    'mala',
    'kiti',
    'milte',
    'miltat',
    'sathi',
    'kuthe',
    'nahi',
    'ani',
    'yojanet',
  ],
  ta: [
    'enna',
    'eppadi',
    'evvalavu',
    'thittam',
    'panam',
    'kidaikkum',
    'venum',
    'yaar',
    'enakku',
    'eppo',
    'illai',
  ],
  en: [
    'the',
    'is',
    'are',
    'what',
    'how',
    'much',
    'who',
    'does',
    'do',
    'can',
    'for',
    'get',
    'give',
    'my',
    'to',
    'of',
    'and',
    'apply',
    'eligible',
    'scheme',
    'money',
    'when',
    'where',
    'which',
  ],
};

const count = (words: string[], tokens: string[]) =>
  tokens.filter((token) => words.includes(token)).length;

/**
 * Language of a typed question, from its script and marker words. Cheap and deterministic, so
 * text questions need no AI call to detect the language. `hint` (the UI language) breaks ties.
 */
export function detectTextLanguage(text: string, hint?: LanguageCode): LanguageCode {
  const tamil = (text.match(/[஀-௿]/g) ?? []).length;
  const devanagari = (text.match(/[ऀ-ॿ]/g) ?? []).length;
  const gujarati = (text.match(/[\u0A80-\u0AFF]/g) ?? []).length;
  const gurmukhi = (text.match(/[\u0A00-\u0A7F]/g) ?? []).length;

  if (tamil > 0 && tamil >= devanagari) return 'ta';
  if (gujarati > 0 || gurmukhi > 0) return hint ?? 'hi';
  if (devanagari > 0) {
    const tokens = text.split(/[\s,.?!।॥]+/);
    const marathi = count(MARATHI_WORDS, tokens) + (text.includes('ळ') ? 2 : 0);
    const hindi = count(HINDI_WORDS, tokens);
    if (marathi > hindi) return 'mr';
    if (hindi > marathi) return 'hi';
    return hint === 'mr' ? 'mr' : 'hi';
  }

  // Latin script: English, or Hindi / Marathi / Tamil typed in Roman letters.
  const tokens = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const uniqueTokens = new Set(tokens);
  const gujaratiMarkers = ['cho', 'chhe', 'tame', 'kem', 'maate', 'mane'];
  const punjabiMarkers = ['tusi', 'tussi', 'kive', 'kiven', 'kithe', 'vich', 'sadde', 'sada'];
  if (
    gujaratiMarkers.filter((word) => uniqueTokens.has(word)).length >= 2 ||
    punjabiMarkers.filter((word) => uniqueTokens.has(word)).length >= 2
  ) {
    return hint ?? 'hi';
  }
  const scores = (['en', 'hi', 'mr', 'ta'] as const).map((code) => ({
    code,
    score: count(LATIN_WORDS[code], tokens),
  }));
  const best = Math.max(...scores.map(({ score }) => score));
  if (best === 0) return hint ?? 'en';
  const leaders = scores.filter(({ score }) => score === best).map(({ code }) => code);
  if (hint && leaders.includes(hint)) return hint;
  return leaders[0]; // English first on a tie
}
