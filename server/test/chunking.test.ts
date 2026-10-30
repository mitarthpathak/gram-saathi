import { describe, expect, it } from 'vitest';
import {
  chunkDocument,
  estimateTokens,
  splitIntoSections,
  splitText,
} from '../src/modules/rag/chunking';
import { parseSchemeDocument } from '../src/modules/rag/documents';

const small = { targetTokens: 40, maxTokens: 60, overlapTokens: 20 };

describe('estimateTokens', () => {
  it('counts about 4 Latin or 2 Indic characters per token', () => {
    expect(estimateTokens('abcdefgh')).toBe(2);
    expect(estimateTokens('किसान')).toBe(3); // 5 code points
    expect(estimateTokens('')).toBe(0);
  });
});

describe('splitIntoSections', () => {
  it('splits at level-2+ headings, drops the title and names the intro "Overview"', () => {
    const markdown =
      '# PM-KISAN\n\nIntro line.\n\n## Benefits\n\n₹6,000 a year.\n\n### How to apply ##\n\nAt a CSC.\n';
    expect(splitIntoSections(markdown)).toEqual([
      { title: 'Overview', text: 'Intro line.' },
      { title: 'Benefits', text: '₹6,000 a year.' },
      { title: 'How to apply', text: 'At a CSC.' },
    ]);
  });

  it('skips headings without text', () => {
    expect(splitIntoSections('## Empty\n\n## Full\n\nText.')).toEqual([
      { title: 'Full', text: 'Text.' },
    ]);
  });
});

describe('splitText', () => {
  it('keeps short text as one piece', () => {
    expect(splitText('  One short paragraph.  ', small)).toEqual(['One short paragraph.']);
  });

  it('packs paragraphs, never exceeds maxTokens and repeats the previous tail as overlap', () => {
    const paragraphs = Array.from(
      { length: 10 },
      (_, i) => `Paragraph ${i} ${'word '.repeat(10).trim()}.`,
    );
    const pieces = splitText(paragraphs.join('\n\n'), small);

    expect(pieces.length).toBeGreaterThan(1);
    for (const piece of pieces) expect(estimateTokens(piece)).toBeLessThanOrEqual(small.maxTokens);
    for (let i = 1; i < pieces.length; i++) {
      const previousTail = pieces[i - 1].split('\n\n').at(-1)!;
      expect(pieces[i].startsWith(previousTail)).toBe(true);
    }
    // Nothing is lost: every paragraph is in some piece.
    for (const paragraph of paragraphs)
      expect(pieces.some((piece) => piece.includes(paragraph))).toBe(true);
  });

  it('falls back to sentences, then words, for very long paragraphs', () => {
    const sentences = 'यह एक लंबा वाक्य है जिसमें कई शब्द हैं। '.repeat(20);
    const words = 'word '.repeat(400);
    for (const text of [sentences, words]) {
      const pieces = splitText(text, small);
      expect(pieces.length).toBeGreaterThan(1);
      for (const piece of pieces)
        expect(estimateTokens(piece)).toBeLessThanOrEqual(small.maxTokens);
    }
  });
});

describe('chunkDocument', () => {
  const document = parseSchemeDocument(
    'pm-kisan.md',
    '---\nschemeId: pm-kisan\nschemeName: PM-KISAN Samman Nidhi\n---\n<!-- SAMPLE -->\n# PM-KISAN\n\n## Benefits\n\n₹6,000 a year.\n\n## Notes\n\nFirst.\n\n## Notes\n\nSecond.\n',
  );

  it('adds scheme metadata and stable, unique chunk ids (duplicate headings get a suffix)', () => {
    const chunks = chunkDocument(document, small);
    expect(chunks.map((chunk) => chunk.chunkId)).toEqual([
      'pm-kisan:benefits:0',
      'pm-kisan:notes:0',
      'pm-kisan:notes-2:0',
    ]);
    expect(chunks[0]).toMatchObject({
      schemeId: 'pm-kisan',
      schemeName: 'PM-KISAN Samman Nidhi',
      section: 'Benefits',
      sourceFile: 'pm-kisan.md',
      text: '₹6,000 a year.',
    });
  });

  it('drops HTML comments from the text', () => {
    expect(chunkDocument(document, small).some((chunk) => chunk.text.includes('SAMPLE'))).toBe(
      false,
    );
  });
});
