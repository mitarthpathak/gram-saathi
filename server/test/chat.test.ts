import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { embedTexts, setGeminiBackend } from '../src/lib/geminiClient';
import { MESSAGES } from '../src/modules/chat/messages';
import {
  answerQuestion,
  clearAnswerCache,
  excerpt,
  toPlainText,
} from '../src/modules/chat/service';
import { DEFAULT_CHUNKING, type DocumentChunk } from '../src/modules/rag/chunking';
import { ANSWER_SYSTEM_PROMPT } from '../src/modules/rag/prompts';
import { setKnowledgeBase } from '../src/modules/rag/service';
import { buildVectorStoreFile, VectorStore } from '../src/modules/rag/vectorStore';
import { SMS_SYSTEM_PROMPT } from '../src/modules/sms/prompts';
import { type FakeGemini, fakeGemini, passageIds } from './fakeGemini';

const chunk = (
  chunkId: string,
  schemeName: string,
  section: string,
  text: string,
): DocumentChunk => ({
  chunkId,
  schemeId: chunkId.split(':')[0],
  schemeName,
  section,
  sourceFile: `${chunkId.split(':')[0]}.md`,
  text,
  tokens: 20,
});

const CHUNKS = [
  chunk(
    'pm-kisan:benefits:0',
    'PM-KISAN Samman Nidhi',
    'Benefits',
    'Eligible farmer families get ₹6,000 per year in three instalments.',
  ),
  chunk(
    'pm-kisan:how-to-apply:0',
    'PM-KISAN Samman Nidhi',
    'How to apply',
    'Register free at pmkisan.gov.in or at a CSC.',
  ),
  chunk(
    'ayushman-bharat-pmjay:benefits:0',
    'Ayushman Bharat PM-JAY',
    'Benefits',
    'Ayushman PM-JAY covers up to ₹5 lakh per family per year.',
  ),
];

/** Answers with the first passage it was given, like a model citing its best source. */
const groundedReply = (answer: string) => (request: { system?: string; input: unknown }) => {
  if (request.system === ANSWER_SYSTEM_PROMPT) {
    return { answer, usedChunkIds: passageIds(request as never).slice(0, 1) };
  }
  if (request.system === SMS_SYSTEM_PROMPT)
    return { sms: 'PM-KISAN: Rs 6000 a year. Register free at a CSC.' };
  throw new Error('unexpected prompt');
};

let fake: FakeGemini;

beforeAll(async () => {
  setGeminiBackend(fakeGemini());
  const vectors = await embedTexts(
    CHUNKS.map((c) => c.text),
    {
      kind: 'document',
      model: 'fake-embed',
      dimensions: 3,
      // Like ingestion: the title (scheme + section) is embedded with the text.
      titles: CHUNKS.map((c) => `${c.schemeName}: ${c.section}`),
    },
  );
  const meta = {
    version: 1 as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    embedModel: 'fake-embed',
    dimensions: 3,
    sourceFingerprint: 'test',
    chunking: DEFAULT_CHUNKING,
    documents: [],
  };
  setKnowledgeBase(new VectorStore(buildVectorStoreFile(meta, CHUNKS, vectors)));
});

beforeEach(() => {
  clearAnswerCache();
  fake = fakeGemini(groundedReply('Under PM-KISAN, farmer families get ₹6,000 a year.'));
  setGeminiBackend(fake);
});

describe('answerQuestion (grounded pipeline)', () => {
  it('answers from the retrieved passages and cites only the passages it used', async () => {
    const response = await answerQuestion({
      text: 'How much money does PM-KISAN give?',
      sessionId: 's1',
    });

    expect(response).toMatchObject({
      sessionId: 's1',
      detectedLanguage: 'en',
      answer: 'Under PM-KISAN, farmer families get ₹6,000 a year.',
      notFound: false,
      usedCache: false,
      fraudWarning: MESSAGES.en.fraudWarning,
      smsText: 'Under PM-KISAN, farmer families get Rs 6,000 a year.',
      smsSegments: 1,
      audioUrl: null,
    });
    expect(response.sources).toEqual([
      {
        schemeId: 'pm-kisan',
        schemeName: 'PM-KISAN Samman Nidhi',
        section: 'Benefits',
        snippet: CHUNKS[0].text,
      },
    ]);
    // Only passages above RAG_MIN_SCORE reach the model: the PM-JAY passage scored 0.
    expect(passageIds(fake.calls[0])).toEqual(['pm-kisan:benefits:0', 'pm-kisan:how-to-apply:0']);
    expect(String(fake.calls[0].input)).toContain('REPLY LANGUAGE: English');
  });

  it('says "not found" without calling the model when nothing is relevant enough', async () => {
    const response = await answerQuestion({ text: 'What is the weather today?', sessionId: 's1' });
    expect(response).toMatchObject({ notFound: true, sources: [], answer: MESSAGES.en.notFound });
    expect(response.smsText).toBe(MESSAGES.en.notFoundSms);
    expect(fake.calls).toHaveLength(0);
  });

  it('says "not found" when the model finds the passages do not answer the question', async () => {
    setGeminiBackend(fakeGemini(() => ({ answer: 'The documents do not say.', usedChunkIds: [] })));
    const response = await answerQuestion({
      text: 'Does PM-KISAN pay for tractors?',
      sessionId: 's1',
    });
    expect(response).toMatchObject({ notFound: true, sources: [], answer: MESSAGES.en.notFound });
  });

  it('answers in the language of the question, with that language’s fixed texts', async () => {
    setGeminiBackend(fakeGemini(groundedReply('पीएम-किसान में साल में ₹6,000 मिलते हैं।')));
    const response = await answerQuestion({
      text: 'पीएम किसान में कितना पैसा मिलता है?',
      sessionId: 's1',
    });
    expect(response.detectedLanguage).toBe('hi');
    expect(response.fraudWarning).toBe(MESSAGES.hi.fraudWarning);
    expect(response.smsSegments).toBe(1);
  });

  it('serves a repeated question from the cache, with the new session id', async () => {
    await answerQuestion({ text: 'How much money does PM-KISAN give?', sessionId: 's1' });
    const again = await answerQuestion({
      text: '  how much money does pm-kisan give  ',
      sessionId: 's2',
    });
    expect(again).toMatchObject({ usedCache: true, sessionId: 's2', notFound: false });
    expect(fake.calls).toHaveLength(1);
  });

  it('shares one pipeline run between identical questions that arrive together', async () => {
    const [a, b] = await Promise.all([
      answerQuestion({ text: 'PM-KISAN amount?', sessionId: 'a' }),
      answerQuestion({ text: 'PM-KISAN amount?', sessionId: 'b' }),
    ]);
    expect(a.answer).toBe(b.answer);
    expect(fake.calls).toHaveLength(1);
  });

  it('asks the model for a shorter SMS when the answer is long', async () => {
    const long = 'Under PM-KISAN, farmer families get ₹6,000 a year in three instalments. '.repeat(
      6,
    );
    setGeminiBackend((fake = fakeGemini(groundedReply(long))));
    const response = await answerQuestion({
      text: 'Tell me all about PM-KISAN money',
      sessionId: 's1',
    });
    expect(response.smsText).toBe('PM-KISAN: Rs 6000 a year. Register free at a CSC.');
    expect(fake.calls.map((call) => call.system)).toEqual([
      ANSWER_SYSTEM_PROMPT,
      SMS_SYSTEM_PROMPT,
    ]);
  });
});

describe('text helpers', () => {
  it('turns Markdown into one plain line', () => {
    expect(
      toPlainText('## Benefits\n- **₹6,000** a year\n- see [the site](https://pmkisan.gov.in)'),
    ).toBe('Benefits ₹6,000 a year see the site');
  });

  it('shortens long snippets at a sentence, else a word, boundary', () => {
    const sentences = `${'A short sentence here. '.repeat(20)}`.trim();
    expect(excerpt(sentences, 100).endsWith('.')).toBe(true);
    expect(excerpt('word '.repeat(100).trim(), 50)).toMatch(/^(word ?)+…$/);
  });
});
