/**
 * Deterministic fact extraction for answer checks. No AI: the same text always gives the same
 * facts. Used by the pipeline audit (facts in an answer must appear in its cited passages) and
 * by the dialect facts lock (a reworded answer must keep exactly the facts of the original).
 *
 * Facts are normalized so that formatting differences do not count as changes:
 * - digits in Devanagari, Tamil and other Indic scripts become ASCII digits;
 * - thousands separators are dropped (₹6,000 = ₹6000 = ₹६,०००);
 * - URLs and bare domains lose their protocol, "www." and trailing punctuation.
 */

/** Zero digit of each Indic block whose digits we normalize (the next nine code points follow). */
const INDIC_ZERO_DIGITS = [
  0x0966, // Devanagari
  0x09e6, // Bengali
  0x0a66, // Gurmukhi
  0x0ae6, // Gujarati
  0x0b66, // Odia
  0x0be6, // Tamil
  0x0c66, // Telugu
  0x0ce6, // Kannada
  0x0d66, // Malayalam
];

/** Replaces Indic-script digits with ASCII digits. */
export function normalizeDigits(text: string): string {
  let output = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const zero = INDIC_ZERO_DIGITS.find((start) => code >= start && code <= start + 9);
    output += zero === undefined ? char : String(code - zero);
  }
  return output;
}

export interface Facts {
  /** Every number, e.g. "6000", "2.5", "14555" (dates and amounts included). */
  numbers: string[];
  /** Rupee amounts, e.g. "₹6000". Their number is also in `numbers`. */
  rupees: string[];
  /** URLs and bare domains, e.g. "pmkisan.gov.in". */
  urls: string[];
  /** Hyphenated phone or helpline numbers, digits only, e.g. "18001801551". */
  phones: string[];
}

const URL_PATTERN =
  /(?:https?:\/\/)?(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:gov\.in|nic\.in|co\.in|org\.in|net\.in|gov|in|com|org|net)\b(?:\/[^\s,;)"'“”‘’<>]*)?/giu;
const PHONE_PATTERN = /(?<![\d.])\d{2,5}(?:[-‐–]\d{2,5}){1,3}(?![\d.])/gu;
const NUMBER_PATTERN = /\d+(?:,\d+)*(?:\.\d+)?/gu;
const RUPEE_BEFORE = /(?:₹|\bRs\.?|\bINR)\s*(\d+(?:,\d+)*(?:\.\d+)?)/giu;
const RUPEE_AFTER =
  /(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:रुपये|रुपए|रुपया|रुपयों|रुपयांचा|रुपयांची|रुपयांपर्यंत|रुपयांपर्यंतचा|रूपये|रूपए|ரூபாய்|rupees?\b)/giu;

/** "6,000" -> "6000"; "007" -> "7"; "2.50" -> "2.5". */
export function normalizeNumber(raw: string): string {
  const plain = raw.replace(/,/g, '');
  if (!plain.includes('.')) return plain.replace(/^0+(?=\d)/, '');
  const [whole, fraction] = plain.split('.');
  const trimmed = fraction.replace(/0+$/, '');
  return `${whole.replace(/^0+(?=\d)/, '')}${trimmed ? `.${trimmed}` : ''}`;
}

/** Lower-case host without protocol, "www." or trailing punctuation/slash. */
export function normalizeUrl(raw: string): string {
  return raw
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[./]+$/, '')
    .toLowerCase();
}

const uniqueSorted = (values: string[]) => [...new Set(values)].sort();

/** The facts in `text`. */
export function extractFacts(text: string): Facts {
  let rest = normalizeDigits(text.normalize('NFC'));

  const urls: string[] = [];
  rest = rest.replace(URL_PATTERN, (match) => {
    urls.push(normalizeUrl(match));
    return ' ';
  });

  const phones: string[] = [];
  rest = rest.replace(PHONE_PATTERN, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length < 6) return match;
    phones.push(digits);
    return ' ';
  });

  const rupees = [
    ...[...rest.matchAll(RUPEE_BEFORE)].map((match) => match[1]),
    ...[...rest.matchAll(RUPEE_AFTER)].map((match) => match[1]),
  ].map((amount) => `₹${normalizeNumber(amount)}`);

  const numbers = (rest.match(NUMBER_PATTERN) ?? []).map(normalizeNumber);

  return {
    numbers: uniqueSorted(numbers),
    rupees: uniqueSorted(rupees),
    urls: uniqueSorted(urls),
    phones: uniqueSorted(phones),
  };
}

const ENGLISH_NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

/**
 * Numbers written as English words in official passages ("three equal instalments"), so an
 * answer that writes "3" is not reported as unsupported. Only for the passage side of a check.
 */
export function englishNumberWords(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  return uniqueSorted(
    words
      .filter((word) => word in ENGLISH_NUMBER_WORDS)
      .map((word) => String(ENGLISH_NUMBER_WORDS[word])),
  );
}

export const FACT_KINDS = [
  'numbers',
  'rupees',
  'urls',
  'phones',
] as const satisfies readonly (keyof Facts)[];

/** Facts of `subset` that `superset` lacks (empty lists = fully supported). */
export function missingFacts(subset: Facts, superset: Facts): Facts {
  const missing = (kind: keyof Facts) =>
    subset[kind].filter((value) => !superset[kind].includes(value));
  return {
    numbers: missing('numbers'),
    rupees: missing('rupees'),
    urls: missing('urls'),
    phones: missing('phones'),
  };
}

export function hasFacts(facts: Facts): boolean {
  return FACT_KINDS.some((kind) => facts[kind].length > 0);
}

/** Merges fact lists (e.g. several cited passages). */
export function mergeFacts(...all: Facts[]): Facts {
  return {
    numbers: uniqueSorted(all.flatMap((facts) => facts.numbers)),
    rupees: uniqueSorted(all.flatMap((facts) => facts.rupees)),
    urls: uniqueSorted(all.flatMap((facts) => facts.urls)),
    phones: uniqueSorted(all.flatMap((facts) => facts.phones)),
  };
}

/** One-line description of facts, for reports: "numbers 6000, 2000; urls pmkisan.gov.in". */
export function describeFacts(facts: Facts): string {
  const parts = FACT_KINDS.filter((kind) => facts[kind].length > 0).map(
    (kind) => `${kind} ${facts[kind].join(', ')}`,
  );
  return parts.join('; ') || 'none';
}
