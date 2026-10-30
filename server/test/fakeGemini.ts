import type { GeminiBackend, GenerateRequest } from '../src/lib/geminiClient';

export interface FakeGemini extends GeminiBackend {
  /** Every generate() request, in order. */
  calls: GenerateRequest[];
}

/**
 * A stand-in for the Gemini API. `reply` returns the JSON object (or raw text) for a generate
 * request, or throws to simulate an API error. Embeddings come from `embed`, or from a tiny
 * topic model: one dimension per topic word, plus one for "anything else".
 */
export function fakeGemini(
  reply: (request: GenerateRequest) => unknown = () => {
    throw new Error('unexpected generate() call');
  },
  embed: (text: string) => number[] = topicVector,
): FakeGemini {
  const calls: GenerateRequest[] = [];
  return {
    calls,
    async generate(request) {
      calls.push(request);
      const output = reply(request);
      return { text: typeof output === 'string' ? output : JSON.stringify(output) };
    },
    async embed(request) {
      return request.texts.map(embed);
    },
  };
}

const TOPICS = [
  ['kisan', 'किसान'],
  ['ayushman', 'आयुष्मान'],
];

export function topicVector(text: string): number[] {
  const lower = text.toLowerCase();
  const hits = TOPICS.map((words) => (words.some((word) => lower.includes(word)) ? 1 : 0));
  return [...hits, hits.some(Boolean) ? 0 : 1];
}

/** The passage ids in an answer prompt, in the order they were sent. */
export function passageIds(request: GenerateRequest): string[] {
  return [...String(request.input).matchAll(/<passage id="([^"]+)"/g)].map((match) => match[1]);
}
