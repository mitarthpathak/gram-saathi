import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { embedTexts, setGeminiBackend } from '../src/lib/geminiClient';
import { getGreetingReply, MESSAGES } from '../src/modules/chat/messages';
import {
  mockDetectLanguage,
  mockGenerateAnswer,
  mockGreeting,
  mockSmallTalk,
  mockSearchSchemes,
} from '../src/mocks/query';
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
import { buildSmsInput, SMS_SYSTEM_PROMPT } from '../src/modules/sms/prompts';
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
  it('answers exact greetings without searching scheme documents', async () => {
    const greetings = [
      { text: 'Hi!', language: 'en' as const },
      { text: 'नमस्ते।', language: 'hi' as const },
      { text: 'नमस्कार!', language: 'mr' as const },
      { text: 'வணக்கம்!', language: 'ta' as const },
    ];

    for (const { text, language } of greetings) {
      const response = await answerQuestion({ text, language, sessionId: 'greeting' });
      expect(response).toMatchObject({
        detectedLanguage: language,
        answer: MESSAGES[language].greeting,
        sources: [],
        notFound: false,
        usedCache: false,
      });
      expect(response.smsText).toBe(MESSAGES[language].greetingSms);
    }

    expect(fake.calls).toHaveLength(0);
  });

  it('does not treat a scheme question that starts with a greeting as small talk', () => {
    expect(getGreetingReply('Hi, how much does PM-KISAN give?', 'en')).toBeUndefined();
  });

  it('answers a Romanised Hindi greeting in Roman script without retrieving or calling Gemini', async () => {
    const response = await answerQuestion({ text: 'Namaste!', sessionId: 'roman-greeting' });

    expect(response).toMatchObject({
      detectedLanguage: 'hi',
      answer: expect.stringMatching(/^Namaste!/),
      sources: [],
      notFound: false,
      fraudWarning: expect.stringMatching(/^Dhokhadhadi/),
    });
    expect(response.answer).not.toMatch(/[ऀ-ॿ]/);
    expect(fake.calls).toHaveLength(0);
  });

  it('answers Roman Hindi small talk in the same language and script without scheme retrieval', async () => {
    const response = await answerQuestion({
      text: 'nu keh rahi kaha se ho',
      language: 'en',
      sessionId: 'roman-hindi-small-talk',
    });

    expect(response).toMatchObject({
      detectedLanguage: 'hi',
      answer: expect.stringMatching(/^Main Gram Saathi hoon/),
      sources: [],
      notFound: false,
    });
    expect(response.answer).not.toMatch(/[\u0900-\u097f]/);
    expect(fake.calls).toHaveLength(0);

    const selectedDialectReply = await answerQuestion({
      text: 'nu keh rahi kaha se ho',
      language: 'en',
      dialectHint: 'wagdi',
      sessionId: 'wagdi-small-talk',
    });
    expect(selectedDialectReply.detectedLanguage).toBe('hi');
    expect(selectedDialectReply.answer).toMatch(/^Main Gram Saathi hoon/);
    expect(selectedDialectReply.dialect?.id).toBe('wagdi');
    expect(fake.calls).toHaveLength(0);
  });

  it('keeps the parent language and selected variety in priority over voice language detection', async () => {
    for (const [dialectHint, nativeName] of [
      ['braj', 'ब्रज'],
      ['wagdi', 'वागड़ी'],
    ] as const) {
      const response = await answerQuestion({
        text: 'PM-KISAN amount?',
        language: 'ta',
        detectedLanguage: 'ta',
        dialectHint,
        sessionId: `dialect-${dialectHint}`,
      });

      expect(response).toMatchObject({
        detectedLanguage: 'hi',
        dialect: { id: dialectHint, confidence: 'high' },
      });
      const answerCall = [...fake.calls].reverse().find((call) => call.system === ANSWER_SYSTEM_PROMPT);
      expect(String(answerCall?.input)).toContain(`Hindi (Latin script), using the ${nativeName}`);
    }
  });

  it('abstains from an automatic medium-confidence dialect and answers in the parent language', async () => {
    let dialectVotes = 0;
    fake = fakeGemini((request) => {
      if (request.system === ANSWER_SYSTEM_PROMPT) {
        return {
          answer: 'PM-KISAN mein ₹6,000 saal ke milte hain.',
          usedChunkIds: passageIds(request as never).slice(0, 1),
        };
      }
      if (request.system === SMS_SYSTEM_PROMPT) {
        return { sms: 'PM-KISAN: ₹6,000 saalana.' };
      }
      if (request.system?.startsWith('Identify the spoken language')) {
        dialectVotes += 1;
        return { label: dialectVotes < 3 ? 'braj' : 'marwari', reason: 'mixed dialect evidence' };
      }
      throw new Error('unexpected prompt');
    });
    setGeminiBackend(fake);

    const response = await answerQuestion({
      text: 'PM-KISAN amount?',
      detectedLanguage: 'hi',
      dialectEvidence: {
        audio: { data: 'AA==', mimeType: 'audio/wav' },
        text: 'mixed dialect transcript',
      },
      sessionId: 'uncertain-dialect',
    });

    expect(response).toMatchObject({ detectedLanguage: 'hi', dialect: null });
    expect(response.dialectCandidates?.map(({ id }) => id)).toContain('braj');
    const answerCall = fake.calls.find((call) => call.system === ANSWER_SYSTEM_PROMPT);
    expect(String(answerCall?.input)).toContain('REPLY LANGUAGE: Hindi (Latin script)');
    expect(String(answerCall?.input)).not.toContain('variety');
  });

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

  it('preserves the source amount and refuses a generated amount absent from its cited passages', async () => {
    fake = fakeGemini(groundedReply('PM-KISAN gives ₹5,000 a year.'));
    setGeminiBackend(fake);
    const response = await answerQuestion({
      text: 'How much money does PM-KISAN give?',
      sessionId: 'wrong-number',
    });

    expect(response).toMatchObject({ notFound: true, answer: MESSAGES.en.notFound, sources: [] });
    expect(fake.calls).toHaveLength(1);
  });

  it('uses Roman script for RAG answers and not-found messages when the user types in Roman letters', async () => {
    fake = fakeGemini(groundedReply('PM-KISAN mein ₹6,000 saal ke milte hain.'));
    setGeminiBackend(fake);
    const found = await answerQuestion({
      text: 'PM Kisan ke liye kitna paisa milta hai?',
      sessionId: 'roman-answer',
    });
    expect(found.detectedLanguage).toBe('hi');
    expect(found.answer).toContain('₹6,000');
    expect(found.answer).not.toMatch(/[ऀ-ॿ]/);
    expect(found.smsText).not.toMatch(/[ऀ-ॿ]/);
    expect(found.fraudWarning).not.toMatch(/[ऀ-ॿ]/);
    expect(String(fake.calls[0].input)).toContain('Hindi (Latin script)');

    const missing = await answerQuestion({ text: 'kya aaj barish hogi?', sessionId: 'roman-missing' });
    expect(missing).toMatchObject({ notFound: true, detectedLanguage: 'hi' });
    expect(missing.answer).toMatch(/^Maaf kijiye/);
    expect(missing.fraudWarning).toMatch(/^Dhokhadhadi/);
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

  it('does not cache dialect detection with a cached answer', async () => {
    let dialectCalls = 0;
    fake = fakeGemini((request) => {
      if (request.system === ANSWER_SYSTEM_PROMPT) {
        return {
          answer: 'Under PM-KISAN, farmer families get ₹6,000 a year.',
          usedChunkIds: passageIds(request),
        };
      }
      if (request.system === SMS_SYSTEM_PROMPT) {
        return { sms: 'PM-KISAN: Rs 6000 a year. Register free at a CSC.' };
      }
      if (request.system?.startsWith('Identify the spoken language')) {
        dialectCalls += 1;
        return {
          label: dialectCalls <= 3 ? 'braj' : 'marwari',
          reason: 'positive variety markers',
        };
      }
      throw new Error('unexpected prompt');
    });
    setGeminiBackend(fake);

    const input = {
      text: 'PM-KISAN amount?',
      dialectEvidence: {
        audio: { data: 'AA==', mimeType: 'audio/wav' },
        text: 'dialect transcript fixture',
      },
    };
    const first = await answerQuestion({ ...input, sessionId: 'dialect-a' });
    const second = await answerQuestion({ ...input, sessionId: 'dialect-b' });
    const third = await answerQuestion({ ...input, sessionId: 'dialect-c' });

    expect(first).toMatchObject({ usedCache: false, dialect: { id: 'braj', confidence: 'high' } });
    expect(second).toMatchObject({
      usedCache: false,
      dialect: { id: 'marwari', confidence: 'high' },
    });
    expect(third).toMatchObject({ usedCache: true, dialect: { id: 'marwari', confidence: 'high' } });
    expect(dialectCalls).toBe(9);
    expect(fake.calls.filter((call) => call.system === ANSWER_SYSTEM_PROMPT)).toHaveLength(2);
  });

  it('a confirmed dialect skips detection and makes the parent language the answer language', async () => {
    const response = await answerQuestion({
      text: 'PM-KISAN amount?',
      dialectHint: 'braj',
      sessionId: 'dialect-hint',
    });

    expect(response).toMatchObject({
      detectedLanguage: 'hi',
      dialect: { id: 'braj', confidence: 'high' },
      dialectCandidates: [],
    });
    expect(
      fake.calls.every((call) => !call.system?.startsWith('Identify the spoken language')),
    ).toBe(true);
    expect(
      String(fake.calls.find((call) => call.system === ANSWER_SYSTEM_PROMPT)?.input),
    ).toContain('REPLY LANGUAGE: Hindi');
  });

  it('does not classify typed text by default', async () => {
    const response = await answerQuestion({
      text: 'PM-KISAN amount?',
      sessionId: 'text-without-dialect-detect',
    });
    expect(response).toMatchObject({ dialect: null, dialectCandidates: [] });
    expect(fake.calls.some((call) => call.system?.startsWith('Identify the spoken language'))).toBe(
      false,
    );
  });

  it('returns the grounded answer when all dialect model views fail', async () => {
    fake = fakeGemini((request) => {
      if (request.system === ANSWER_SYSTEM_PROMPT) {
        return {
          answer: 'Under PM-KISAN, farmer families get ₹6,000 a year.',
          usedChunkIds: passageIds(request),
        };
      }
      if (request.system === SMS_SYSTEM_PROMPT) {
        return { sms: 'PM-KISAN: Rs 6000 a year. Register free at a CSC.' };
      }
      if (request.system?.startsWith('Identify the spoken language')) {
        throw new Error('simulated dialect service failure');
      }
      throw new Error('unexpected prompt');
    });
    setGeminiBackend(fake);

    const response = await answerQuestion({
      text: 'PM-KISAN amount?',
      sessionId: 'dialect-error',
      dialectEvidence: {
        audio: { data: 'AA==', mimeType: 'audio/wav' },
        text: 'dialect transcript fixture',
      },
    });

    expect(response).toMatchObject({ notFound: false, dialect: null, dialectCandidates: [] });
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
  it('keeps the fixed and generated mock replies friendly and in Roman script', () => {
    expect(mockDetectLanguage('Hi!', 'hi')).toBe('en');
    expect(mockDetectLanguage('nu keh ki kaha se ho', 'en')).toBe('hi');
    expect(mockDetectLanguage('nu keh rahi kaha se ho', 'en')).toBe('hi');
    expect(mockDetectLanguage('नमस्कार!', 'mr')).toBe('mr');
    expect(mockGreeting('Hi!', 'en')?.answer).toMatch(/^Hi!/);
    expect(mockGreeting('Namaste!', 'hi', 'roman')?.answer).toMatch(/^Namaste!/);
    const mock = mockGenerateAnswer(mockSearchSchemes('PM-KISAN amount', 3), 'hi', 'roman');
    expect(mock.answer).toContain('₹6,000');
    expect(mock.answer).not.toMatch(/[ऀ-ॿ]/);
    expect(mockGenerateAnswer([], 'hi', 'roman').answer).toMatch(/^Maaf kijiye/);
    expect(mockSmallTalk('nu keh ki kaha se ho', 'hi', 'roman')?.answer).toMatch(
      /^Main Gram Saathi hoon/,
    );
    expect(mockSmallTalk('nu keh rahi kaha se ho', 'hi', 'roman')?.answer).toMatch(
      /^Main Gram Saathi hoon/,
    );
  });

  it('turns Markdown into one plain line', () => {
    expect(
      toPlainText('## Benefits\n- **₹6,000** a year\n- see [the site](https://pmkisan.gov.in)'),
    ).toBe('Benefits ₹6,000 a year see the site');
  });

  it('keeps the requested script in the SMS shortening prompt', () => {
    expect(buildSmsInput('PM-KISAN mein ₹6,000 milte hain.', 'hi', 140, 'Latin')).toContain(
      'LANGUAGE: Hindi (Latin script)',
    );
  });

  it('shortens long snippets at a sentence, else a word, boundary', () => {
    const sentences = `${'A short sentence here. '.repeat(20)}`.trim();
    expect(excerpt(sentences, 100).endsWith('.')).toBe(true);
    expect(excerpt('word '.repeat(100).trim(), 50)).toMatch(/^(word ?)+…$/);
  });
});
