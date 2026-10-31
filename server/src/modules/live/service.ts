import {
  GoogleGenAI,
  Modality,
  Type,
  type AuthToken,
  type CreateAuthTokenParameters,
} from '@google/genai';
import type { LiveTokenRequest, LiveTokenResponse } from '@gram-saathi/shared';
import { env, isMocked } from '../../config/env';
import { classifyGeminiError, GeminiError, withRetries } from '../../lib/geminiClient';
import { getDialectExemplars, renderPromptExemplars } from '../dialect/exemplars';
import { buildLiveSystemInstruction } from './prompts';
import { mockLiveToken } from './mock';

interface LiveTokenClient {
  authTokens: {
    create(params: CreateAuthTokenParameters): Promise<AuthToken>;
  };
}

export interface LiveTokenServiceDeps {
  isMocked: () => boolean;
  apiKey?: string;
  model: string;
  voice: string;
  tokenTtlSeconds: number;
  timeoutMs: number;
  createClient: (apiKey: string) => LiveTokenClient;
  getDialectExamples: (dialectHint: string) => string[];
  now: () => Date;
}

const defaultDeps: LiveTokenServiceDeps = {
  isMocked: () => isMocked('live'),
  apiKey: env.GEMINI_API_KEY,
  model: env.GEMINI_LIVE_MODEL,
  voice: env.GEMINI_LIVE_VOICE,
  tokenTtlSeconds: env.GEMINI_LIVE_TOKEN_TTL_SECONDS,
  timeoutMs: env.GEMINI_TIMEOUT_MS,
  createClient: (apiKey) => new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1beta' } }),
  getDialectExamples: (dialectHint) =>
    renderPromptExemplars([dialectHint], getDialectExemplars(), {
      perLabel: env.DIALECT_EXEMPLARS_PER_LABEL,
      tokenBudget: Math.min(env.DIALECT_EXEMPLAR_TOKEN_BUDGET, 300),
    }),
  now: () => new Date(),
};

/** Mints a one-use token with every security- and behavior-sensitive setup field constrained. */
export async function createLiveToken(
  request: LiveTokenRequest,
  deps: LiveTokenServiceDeps = defaultDeps,
): Promise<LiveTokenResponse> {
  if (deps.isMocked()) return mockLiveToken(deps.now(), deps.tokenTtlSeconds);
  if (!deps.apiKey) {
    throw new GeminiError('not_configured', 'Gemini is not configured: set GEMINI_API_KEY');
  }

  const now = deps.now();
  const expiresAt = new Date(now.getTime() + deps.tokenTtlSeconds * 1000).toISOString();
  const newSessionExpiresAt = new Date(now.getTime() + 60_000).toISOString();
  const dialectExamples = request.dialectHint ? deps.getDialectExamples(request.dialectHint) : [];
  const systemInstruction = buildLiveSystemInstruction({
    language: request.language,
    dialectHint: request.dialectHint,
    dialectExamples,
  });
  const params: CreateAuthTokenParameters = {
    config: {
      uses: 1,
      expireTime: expiresAt,
      newSessionExpireTime: newSessionExpiresAt,
      httpOptions: {
        apiVersion: 'v1beta',
        timeout: deps.timeoutMs,
        retryOptions: { attempts: 1 },
      },
      liveConnectConstraints: {
        model: deps.model,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: deps.voice } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction,
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'ask_gram_saathi',
                  description:
                    'Use for every government-scheme question. Returns a spoken-style answer grounded in scheme documents and an optional fraud warning.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: { question: { type: Type.STRING } },
                    required: ['question'],
                  },
                  response: {
                    type: Type.OBJECT,
                    properties: {
                      answer: { type: Type.STRING },
                      fraudWarning: { type: Type.STRING },
                    },
                    required: ['answer'],
                  },
                },
              ],
            },
          ],
        },
      },
    },
  };

  try {
    const client = deps.createClient(deps.apiKey);
    const token = await withRetries(() => client.authTokens.create(params), {
      label: 'live_token',
      maxRetries: 0,
    });
    if (!token.name) throw new GeminiError('bad_response', 'Gemini returned no Live token');
    return {
      token: token.name,
      model: deps.model,
      expiresAt: token.expireTime ?? expiresAt,
      newSessionExpiresAt: token.newSessionExpireTime ?? newSessionExpiresAt,
      mock: false,
    };
  } catch (error) {
    if (error instanceof GeminiError) throw error;
    throw (
      classifyGeminiError(error) ??
      new GeminiError('bad_request', 'Gemini rejected the Live token request', { cause: error })
    );
  }
}
