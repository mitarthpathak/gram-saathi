import { beforeEach, describe, expect, it } from 'vitest';
import { setGeminiBackend } from '../src/lib/geminiClient';
import { clearAnswerCache } from '../src/modules/chat/service';
import { clearConversationHistory } from '../src/modules/chat/conversation';
import { answerVoiceQuery } from '../src/modules/voice/service';
import { fakeGemini } from './fakeGemini';

describe('voice transcript conversation routing', () => {
  beforeEach(() => {
    clearAnswerCache();
    clearConversationHistory();
  });

  it('sends fake STT output through the same clarify path as text and preserves the selected dialect', async () => {
    const fake = fakeGemini((request) => {
      if (request.input instanceof Array && request.input.some((part) => part.type === 'audio')) {
        return { transcript: 'ki keh raho he', detectedLanguage: 'hi', script: 'Latin' };
      }
      if (request.system?.includes('You are the front door')) {
        return {
          intent: 'clarify', language: 'hi', dialect: 'model-dialect', searchQueryEn: '',
          reply: 'मैं फिर से आसान शब्दों में बताता हूँ।',
        };
      }
      throw new Error('unexpected model call');
    });
    setGeminiBackend(fake);

    const response = await answerVoiceQuery({
      audio: Buffer.from('fake audio'), mimeType: 'audio/webm', language: 'hi',
      dialectHint: 'braj', sessionId: 'voice-session',
    });

    expect(response.transcript).toBe('ki keh raho he');
    expect(response.detectedLanguage).toBe('hi');
    expect(response).toMatchObject({ answer: 'मैं फिर से आसान शब्दों में बताता हूँ।', sources: [], notFound: false });
    expect(fake.calls.filter((call) => call.system?.includes('You are the front door'))).toHaveLength(1);
    expect(fake.calls.find((call) => call.system?.includes('You are the front door'))?.system).toContain('selected the dialect "braj"');
  });
});
