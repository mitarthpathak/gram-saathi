import { slugify, type SchemeDocument } from './documents';

export interface ChunkingOptions {
  /** Pieces are packed up to about this many tokens... */
  targetTokens: number;
  /** ...and never exceed this many. */
  maxTokens: number;
  /** Tokens of the previous piece repeated at the start of the next one. */
  overlapTokens: number;
}

/** ~500-800 token chunks with a small overlap. Token counts are estimates. */
export const DEFAULT_CHUNKING: ChunkingOptions = {
  targetTokens: 600,
  maxTokens: 800,
  overlapTokens: 80,
};

export interface DocumentChunk {
  /** Stable id: `${schemeId}:${section slug}:${piece index}`, e.g. "pm-kisan:eligibility:0". */
  chunkId: string;
  schemeId: string;
  schemeName: string;
  /** Heading of the section the text comes from. */
  section: string;
  sourceFile: string;
  text: string;
  /** Estimated token count. */
  tokens: number;
}

export interface Section {
  title: string;
  text: string;
}

/**
 * Rough token count without a tokenizer: about 4 characters per token for Latin script and
 * about 2 for Indic scripts.
 */
export function estimateTokens(text: string): number {
  let ascii = 0;
  let other = 0;
  for (const char of text) {
    if (char.charCodeAt(0) < 128) ascii++;
    else other++;
  }
  return Math.ceil(ascii / 4 + other / 2);
}

/**
 * Splits Markdown into sections at headings of level 2 and deeper. A level-1 heading is the
 * document title and is dropped; text before the first section goes into `defaultTitle`.
 */
export function splitIntoSections(markdown: string, defaultTitle = 'Overview'): Section[] {
  const sections: Section[] = [];
  let title = defaultTitle;
  let lines: string[] = [];
  const flush = () => {
    const text = lines.join('\n').trim();
    if (text) sections.push({ title, text });
  };

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading && heading[1].length === 1) continue;
    if (heading) {
      flush();
      title = heading[2].trim();
      lines = [];
    } else {
      lines.push(line);
    }
  }
  flush();
  return sections;
}

interface Unit {
  text: string;
  tokens: number;
  /** What goes between this unit and the one before it. */
  joiner: string;
}

/**
 * Splits text into pieces of about `targetTokens` (never more than `maxTokens`), breaking at
 * paragraphs, then sentences, then words. Each piece after the first starts with up to
 * `overlapTokens` of the previous piece's tail, so facts spanning a break stay findable.
 */
export function splitText(text: string, options: ChunkingOptions = DEFAULT_CHUNKING): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (estimateTokens(trimmed) <= options.maxTokens) return [trimmed];

  const pieces: string[] = [];
  let current: Unit[] = [];
  let currentTokens = 0;

  for (const unit of toUnits(trimmed, options.maxTokens)) {
    if (current.length > 0 && currentTokens + unit.tokens > options.targetTokens) {
      pieces.push(joinUnits(current));
      // Carry the tail of the finished piece over as overlap (never the whole piece).
      const overlap: Unit[] = [];
      let overlapTokens = 0;
      for (let i = current.length - 1; i > 0; i--) {
        if (overlapTokens + current[i].tokens > options.overlapTokens) break;
        overlap.unshift(current[i]);
        overlapTokens += current[i].tokens;
      }
      current = overlap;
      currentTokens = overlapTokens;
    }
    // Drop overlap if it would push the piece past the hard limit.
    while (current.length > 0 && currentTokens + unit.tokens > options.maxTokens) {
      currentTokens -= current.shift()!.tokens;
    }
    current.push(unit);
    currentTokens += unit.tokens;
  }
  if (current.length > 0) pieces.push(joinUnits(current));
  return pieces;
}

/** Paragraphs; paragraphs that are too long become sentences, then runs of words. */
function toUnits(text: string, maxTokens: number): Unit[] {
  const units: Unit[] = [];
  for (const paragraph of text.split(/\n\s*\n/)) {
    const clean = paragraph.trim();
    if (!clean) continue;
    const parts =
      estimateTokens(clean) <= maxTokens
        ? [clean]
        : clean
            .split(/(?<=[.!?।॥])\s+/u)
            .flatMap((sentence) =>
              estimateTokens(sentence) <= maxTokens ? [sentence] : splitWords(sentence, maxTokens),
            );
    parts.forEach((part, index) => {
      units.push({ text: part, tokens: estimateTokens(part), joiner: index === 0 ? '\n\n' : ' ' });
    });
  }
  return units;
}

function splitWords(sentence: string, maxTokens: number): string[] {
  const runs: string[] = [];
  let run = '';
  for (const word of sentence.split(/\s+/)) {
    const candidate = run ? `${run} ${word}` : word;
    if (run && estimateTokens(candidate) > maxTokens) {
      runs.push(run);
      run = word;
    } else {
      run = candidate;
    }
  }
  if (run) runs.push(run);
  return runs;
}

function joinUnits(units: Unit[]): string {
  return units.map((unit, index) => (index === 0 ? '' : unit.joiner) + unit.text).join('');
}

/** Section-first chunking of one document, with metadata on every chunk. */
export function chunkDocument(
  document: SchemeDocument,
  options: ChunkingOptions = DEFAULT_CHUNKING,
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const usedPrefixes = new Set<string>();

  for (const section of splitIntoSections(document.body)) {
    const slug = slugify(section.title) || 'section';
    // Two sections with the same heading still get distinct ids.
    let prefix = `${document.schemeId}:${slug}`;
    for (let n = 2; usedPrefixes.has(prefix); n++) prefix = `${document.schemeId}:${slug}-${n}`;
    usedPrefixes.add(prefix);

    splitText(section.text, options).forEach((text, index) => {
      chunks.push({
        chunkId: `${prefix}:${index}`,
        schemeId: document.schemeId,
        schemeName: document.schemeName,
        section: section.title,
        sourceFile: document.sourceFile,
        text,
        tokens: estimateTokens(text),
      });
    });
  }
  return chunks;
}
