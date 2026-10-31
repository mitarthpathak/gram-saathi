import { beforeEach, describe, expect, it } from 'vitest';
import { embedTexts, setGeminiBackend } from '../src/lib/geminiClient';
import { answerQuestion, clearAnswerCache, excerpt, toPlainText } from '../src/modules/chat/service';
import { clearConversationHistory } from '../src/modules/chat/conversation';
import { DEFAULT_CHUNKING, type DocumentChunk } from '../src/modules/rag/chunking';
import { setKnowledgeBase } from '../src/modules/rag/service';
import { buildVectorStoreFile, VectorStore } from '../src/modules/rag/vectorStore';
import { fakeGemini, topicVector } from './fakeGemini';

const chunk: DocumentChunk = {
  chunkId: 'pm-kisan:benefit:0', schemeId: 'pm-kisan', schemeName: 'PM-KISAN', section: 'Benefit',
  sourceFile: 'pm-kisan.md', text: 'The benefit is ₹6,000 each year.', tokens: 10,
};

let answerUnsupported = false;

describe('answerQuestion conversation service', () => {
  beforeEach(async () => {
    clearAnswerCache();
    clearConversationHistory();
    answerUnsupported = false;
    setGeminiBackend(fakeGemini(() => null, topicVector));
    const vectors = await embedTexts([chunk.text], {
      kind: 'document', model: 'fake-embed', dimensions: 3, titles: ['PM-KISAN: Benefit'],
    });
    setKnowledgeBase(new VectorStore(buildVectorStoreFile({
      version: 1, createdAt: '2026-01-01T00:00:00.000Z', embedModel: 'fake-embed', dimensions: 3,
      sourceFingerprint: 'test', chunking: DEFAULT_CHUNKING, documents: [],
    }, [chunk], vectors)));
    setGeminiBackend(fakeGemini((request) => {
    if (request.system?.includes('You are the front door')) {
      const prompt = String(request.input);
      const message = prompt.split('Latest user message:\n').at(-1)?.trim() ?? '';
      if (message === 'ki keh raho he') {
        return { intent: 'clarify', language: 'hi', dialect: null, searchQueryEn: '', reply: 'मैं आसान शब्दों में फिर से बताता हूँ।' };
      }
      if (/^(hello|hi)$/i.test(message)) {
        return { intent: 'smalltalk', language: 'en', dialect: null, searchQueryEn: '', reply: 'Hello! Ask me about a government scheme.' };
      }
      return { intent: 'scheme_question', language: 'en', dialect: null, searchQueryEn: 'PM-KISAN annual benefit', reply: '' };
    }
    if (request.system?.startsWith('You answer a question')) {
      if (answerUnsupported) return { answersQuestion: false, answer: '', usedChunkIds: [] };
      const id = /\[([^\]]+)\]/.exec(String(request.input))?.[1];
      return { answersQuestion: true, answer: 'PM-KISAN gives ₹6,000 each year.', usedChunkIds: id ? [id] : [] };
    }
    throw new Error('unexpected prompt');
    }, topicVector));
  });

  it('routes "ki keh raho he" to a short native-script clarification without sources', async () => {
    const response = await answerQuestion({ text: 'ki keh raho he', language: 'hi', sessionId: 'clarify' });
    expect(response.answer).toMatch(/^[\u0900-\u097f\s।]+$/u);
    expect(response.sources).toEqual([]);
    expect(response.notFound).toBe(false);
  });

  it('uses the English query for retrieval and returns a grounded passage citation', async () => {
    const response = await answerQuestion({ text: 'PM Kisan annual benefit', language: 'en', sessionId: 'grounded' });
    expect(response.answer).toContain('₹6,000');
    expect(response.sources).toHaveLength(1);
    expect(response.sources[0]).toMatchObject({ schemeId: 'pm-kisan', section: 'Benefit' });
    expect(response.notFound).toBe(false);
  });

  it('returns reviewed not-found text when the answer model cannot support a claim', async () => {
    answerUnsupported = true;
    const response = await answerQuestion({ text: 'PM Kisan annual benefit', language: 'hi', sessionId: 'unknown' });
    expect(response.notFound).toBe(true);
    expect(response.sources).toEqual([]);
  });
});

describe('chat text helpers', () => {
  it('turns Markdown into one plain line', () => {
    expect(toPlainText('## Heading\n- **One**\n[link](https://example.com)')).toBe('Heading One link');
  });

  it('shortens long snippets at a sentence or word boundary', () => {
    expect(excerpt('First sentence. Second sentence that is much longer than the limit.', 24)).toBe('First sentence.');
    expect(excerpt('A long chunk with several words and more text.', 20)).toMatch(/…$/u);
  });
});
