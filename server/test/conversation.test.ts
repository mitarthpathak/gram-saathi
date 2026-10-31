import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearConversationHistory,
  getHistory,
  handleTurn,
  recordTurn,
  type Deps,
  type Passage,
  type Understood,
  type Answered,
} from '../src/modules/chat/conversation';

const passage: Passage = {
  id: 'pm-kisan#overview', schemeName: 'PM-KISAN', section: 'Overview',
  text: 'The benefit is ₹6,000 each year.', score: 0.9,
};

function deps(understood: Partial<Understood>, answered: Partial<Answered> = {}): Deps & { queries: string[]; systems: string[] } {
  const queries: string[] = [];
  const systems: string[] = [];
  return {
    queries,
    systems,
    minScore: 0.5,
    search: async (query) => { queries.push(query); return [passage]; },
    generateJson: async <T>({ system, prompt }: { system: string; prompt: string }) => {
      systems.push(system);
      if (prompt.includes('Recent conversation:')) {
        return {
          intent: 'scheme_question', language: 'hi', dialect: null, searchQueryEn: 'annual PM-KISAN benefit', reply: '',
          ...understood,
        } as T;
      }
      return {
        answersQuestion: true, answer: 'हर साल ₹6,000 मिलते हैं।', usedChunkIds: [passage.id],
        ...answered,
      } as T;
    },
  };
}

describe('conversation layer', () => {
  beforeEach(clearConversationHistory);

  it('returns a grounded answer using an English standalone query', async () => {
    const fake = deps({});
    const result = await handleTurn(fake, { text: 'PM Kisan me kitna milta hai?', history: [] });
    expect(result).toMatchObject({ kind: 'grounded', usedChunkIds: [passage.id] });
    expect(fake.queries).toEqual(['annual PM-KISAN benefit']);
  });

  it('returns notFound below the score threshold', async () => {
    const fake = deps({});
    fake.search = async () => [{ ...passage, score: 0.2 }];
    expect(await handleTurn(fake, { text: 'scheme details', history: [] })).toMatchObject({ kind: 'notFound' });
  });

  it('answers smalltalk directly without retrieval', async () => {
    const fake = deps({ intent: 'smalltalk', reply: 'नमस्ते! योजना के बारे में पूछिए।' });
    expect(await handleTurn(fake, { text: 'hello', history: [] })).toMatchObject({ kind: 'direct', intent: 'smalltalk' });
    expect(fake.queries).toHaveLength(0);
  });

  it('clarifies "ki keh raho he" using the prior assistant turn', async () => {
    const fake = deps({ intent: 'clarify', reply: 'मैंने कहा कि हर साल ₹6,000 मिलते हैं।' });
    const result = await handleTurn(fake, {
      text: 'ki keh raho he', history: [{ role: 'assistant', text: 'हर साल ₹6,000 मिलते हैं।' }],
    });
    expect(result).toMatchObject({ kind: 'direct', intent: 'clarify' });
    expect(fake.systems[0]).toContain('ki keh raho he');
    expect(fake.queries).toHaveLength(0);
  });

  it('handles out-of-scope directly', async () => {
    const fake = deps({ intent: 'out_of_scope', reply: 'मैं सरकारी योजनाओं के बारे में मदद करता हूँ।' });
    expect(await handleTurn(fake, { text: 'weather today', history: [] })).toMatchObject({ kind: 'direct', intent: 'out_of_scope' });
    expect(fake.queries).toHaveLength(0);
  });

  it('rejects hallucinated chunk ids and never reports ids absent from search', async () => {
    const fake = deps({}, { usedChunkIds: ['invented-id'] });
    expect(await handleTurn(fake, { text: 'scheme details', history: [] })).toMatchObject({ kind: 'notFound' });
    const withMixedIds = deps({}, { usedChunkIds: [passage.id, 'invented-id'] });
    expect(await handleTurn(withMixedIds, { text: 'scheme details', history: [] })).toMatchObject({ kind: 'grounded', usedChunkIds: [passage.id] });
  });

  it('returns notFound when the answer model says it cannot answer', async () => {
    const fake = deps({}, { answersQuestion: false, answer: '', usedChunkIds: [] });
    expect(await handleTurn(fake, { text: 'scheme details', history: [] })).toMatchObject({ kind: 'notFound' });
  });

  it('does not fall through to RAG for non-scheme intent with an empty reply', async () => {
    const fake = deps({ intent: 'smalltalk', reply: '' });
    expect(await handleTurn(fake, { text: 'hello', history: [] })).toMatchObject({ kind: 'notFound', intent: 'smalltalk' });
    expect(fake.queries).toHaveLength(0);
  });

  it('passes a dialect hint to understanding but writes the grounded answer in the standard language', async () => {
    const fake = deps({ dialect: 'model-label' });
    const result = await handleTurn(fake, { text: 'scheme details', history: [], dialectHint: 'braj' });
    expect(result).toMatchObject({ kind: 'grounded', dialect: 'braj' });
    expect(fake.systems[0]).toContain('selected the dialect "braj"');
    // Dialect wording is a separate, facts-checked step (dialectRender.ts), not the answer prompt.
    expect(fake.systems[1]).not.toContain('braj');
    expect(fake.systems[1]).not.toContain('model-label');
  });

  it('never lets the model\'s own dialect guess style or label a reply', async () => {
    const fake = deps({ dialect: 'model-label' });
    const result = await handleTurn(fake, { text: 'scheme details', history: [] });
    expect(result).toMatchObject({ kind: 'grounded', dialect: null });
    expect(fake.systems[1]).not.toContain('model-label');
  });

  it('caps history at six turns and evicts least-recently-used sessions above 500', () => {
    for (let index = 0; index < 5; index++) recordTurn('history', `u${index}`, `a${index}`);
    expect(getHistory('history')).toHaveLength(6);
    expect(getHistory('history')[0]).toEqual({ role: 'user', text: 'u2' });
    clearConversationHistory();
    for (let index = 0; index < 501; index++) recordTurn(`session-${index}`, 'u', 'a');
    expect(getHistory('session-0')).toHaveLength(0);
    expect(getHistory('session-500')).toHaveLength(2);
  });
});
