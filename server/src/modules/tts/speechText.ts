/**
 * Text preparation for speech. TTS models read their input verbatim, so anything that is not
 * meant to be heard (Markdown markers, emoji) is removed here; words, numbers, amounts, URLs and
 * phone numbers are never changed, and no instruction is ever added to the text.
 */

const EMOJI_SEQUENCE =
  /\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic})*/gu;
const REGIONAL_INDICATOR = /[\u{1F1E6}-\u{1F1FF}]/gu;
// Variation selector-16 and the keycap mark; ZWJ/ZWNJ stay because Indic scripts use them.
const EMOJI_LEFTOVERS = /[️⃣]/gu;

/** Removes Markdown markers and emoji; collapses whitespace. Plain text comes back unchanged. */
export function cleanTextForSpeech(text: string): string {
  return (
    text
      // [label](url): keep the label, and the URL too when it is not the label itself.
      .replace(/!?\[([^\]\n]*)\]\(([^)\s]+)\)/g, (_match, label: string, url: string) => {
        const shown = label.trim();
        if (!shown || shown === url) return url;
        return `${shown} ${url}`;
      })
      .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '') // headings
      .replace(/^[ \t]*>[ \t]?/gm, '') // block quotes
      .replace(/^[ \t]*[-*+•][ \t]+/gm, '') // bullets (numbered lists are kept: numbers are facts)
      .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2') // bold
      .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '$1') // strikethrough
      .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?!\w)/g, '$1$2') // *italic*
      .replace(/`+/g, '')
      .replace(EMOJI_SEQUENCE, '')
      .replace(REGIONAL_INDICATOR, '')
      .replace(EMOJI_LEFTOVERS, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** A sentence ends at . ! ? । ॥ followed by whitespace (so "pmkisan.gov.in" and "1.5" stay whole). */
const SENTENCE_BREAK = /(?<=[.!?।॥])\s+/u;
const CLAUSE_BREAK = /(?<=[,;:])\s+/u;

function pack(parts: string[], maxChars: number): string[] {
  const pieces: string[] = [];
  let current = '';
  for (const part of parts) {
    if (!current) current = part;
    else if (current.length + 1 + part.length <= maxChars) current = `${current} ${part}`;
    else {
      pieces.push(current);
      current = part;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

function splitLong(sentence: string, maxChars: number): string[] {
  if (sentence.length <= maxChars) return [sentence];
  const clauses = sentence.split(CLAUSE_BREAK);
  const out: string[] = [];
  for (const clause of clauses.length > 1 ? clauses : [sentence]) {
    if (clause.length <= maxChars) {
      out.push(clause);
      continue;
    }
    for (const word of clause.split(' ')) {
      // A single "word" longer than the limit (a very long URL) is cut as a last resort.
      for (let start = 0; start < word.length; start += maxChars) {
        out.push(word.slice(start, start + maxChars));
      }
    }
  }
  return pack(out, maxChars);
}

/**
 * Splits text into pieces of at most `maxChars`, at sentence boundaries where possible, then at
 * clause boundaries, then between words. Joining the pieces with single spaces gives the text back
 * (except a single word longer than `maxChars`, which is cut).
 */
export function splitForSpeech(text: string, maxChars: number): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];
  const sentences = clean
    .split(SENTENCE_BREAK)
    .flatMap((sentence) => splitLong(sentence, maxChars));
  return pack(sentences, maxChars);
}
