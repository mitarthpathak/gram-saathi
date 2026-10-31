/**
 * Audit worker for deterministic checks with a FAKE Gemini backend (no network, no key):
 * Stage I (robustness / error codes) and the call-shape part of Stage J.
 * The orchestrator starts it with NODE_ENV=test, USE_MOCKS=false and an empty GEMINI_API_KEY,
 * so a developer's .env is never read and no real call can happen.
 *   tsx scripts/audit/fakeWorker.ts <out.json>
 */
import { writeFileSync } from 'node:fs';
import type { Request, Response } from 'express';
import { env } from '../../src/config/env';
import {
  embedTexts,
  setGeminiBackend,
  setGeminiObserver,
  type GeminiBackend,
  type GeminiCallRecord,
  type GenerateRequest,
} from '../../src/lib/geminiClient';
import { HttpError } from '../../src/lib/httpError';
import { rateLimit } from '../../src/middleware/rateLimit';
import { clearAnswerCache } from '../../src/modules/chat/service';
import { clearConversationHistory } from '../../src/modules/chat/conversation';
import { DEFAULT_CHUNKING, type DocumentChunk } from '../../src/modules/rag/chunking';
import { setKnowledgeBase } from '../../src/modules/rag/service';
import { buildVectorStoreFile, VectorStore } from '../../src/modules/rag/vectorStore';
import { synthesizeSpeech } from '../../src/modules/tts/service';
import { sequentialDepth, silentWav } from './checks';
import { runStage, sessionId } from './context';
import { errorCode, openTransport, type Transport } from './transport';
import type { Check, StageResult, WorkerOutput } from './types';

/** Sequential call depth allowed per request before the path is flagged. */
export const MAX_SEQUENTIAL_CALLS = 4;

const FAKE_DELAY_MS = 25;
const QUESTION_HI = 'पीएम किसान योजना में साल में कितना पैसा मिलता है?';
/** Long enough (over two Unicode SMS segments) that the SMS step really calls the model. */
const FAKE_ANSWER =
  'पीएम-किसान में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं। यह पैसा सीधे बैंक खाते में आता है। ज़्यादा जानकारी के लिए नज़दीकी CSC केंद्र पर पूछें।';

interface Scenario {
  transcript: string;
  failWith?: Record<string, unknown>;
}
const scenario: Scenario = { transcript: QUESTION_HI };

function topicVector(text: string): number[] {
  const lower = text.toLowerCase();
  const kisan = ['kisan', 'किसान'].some((word) => lower.includes(word)) ? 1 : 0;
  return [kisan, 0, kisan ? 0 : 1];
}

function schemaProperties(request: GenerateRequest): Record<string, { enum?: string[] }> {
  const schema = request.jsonSchema as { properties?: Record<string, { enum?: string[] }> };
  return schema.properties ?? {};
}

function inputText(request: GenerateRequest): string {
  return typeof request.input === 'string'
    ? request.input
    : request.input.map((part) => (part.type === 'text' ? part.text : '')).join('\n');
}

/** Plausible JSON for every structured call the server makes, chosen by the schema's fields. */
export function fakeReply(request: GenerateRequest): unknown {
  const properties = schemaProperties(request);
  const keys = Object.keys(properties);
  const text = inputText(request);
  if (keys.includes('transcript'))
    return { transcript: scenario.transcript, detectedLanguage: 'hi', script: 'Devanagari' };
  if (keys.includes('label') && keys.includes('reason')) {
    const labels = properties.label.enum ?? ['hindi'];
    return { label: labels.includes('hindi') ? 'hindi' : labels[0], reason: 'fake' };
  }
  if (keys.includes('intent')) {
    const message = text.split('Latest user message:\n').at(-1)?.trim() ?? '';
    if (/keh raho|samajh nahi/i.test(message)) {
      return {
        intent: 'clarify',
        language: 'hi',
        dialect: null,
        searchQueryEn: '',
        reply: 'मैं आसान शब्दों में फिर से बताता हूँ।',
      };
    }
    return {
      intent: 'scheme_question',
      language: 'hi',
      dialect: null,
      searchQueryEn: 'PM-KISAN annual benefit',
      reply: '',
    };
  }
  if (keys.includes('answersQuestion')) {
    const id = /\[([^\]]+)\]/.exec(text)?.[1];
    return { answersQuestion: true, answer: FAKE_ANSWER, usedChunkIds: id ? [id] : [] };
  }
  if (keys.includes('sms')) return { sms: 'पीएम-किसान: साल में ₹6,000।' };
  // Any other structured call (for example a dialect rendering step): echo the answer text.
  const answer = /"answer"\s*:\s*"([^"]+)"/.exec(text)?.[1] ?? FAKE_ANSWER;
  return Object.fromEntries(keys.map((key) => [key, answer]));
}

const delay = () => new Promise((resolve) => setTimeout(resolve, FAKE_DELAY_MS));

const fakeBackend: GeminiBackend = {
  async generate(request) {
    await delay();
    if (scenario.failWith)
      throw Object.assign(
        new Error(String(scenario.failWith.message ?? 'fake failure')),
        scenario.failWith,
      );
    return { text: JSON.stringify(fakeReply(request)) };
  },
  async embed(request) {
    await delay();
    return request.texts.map(topicVector);
  },
};

async function installFakeKnowledgeBase(): Promise<void> {
  const chunk: DocumentChunk = {
    chunkId: 'pm-kisan:benefits:0',
    schemeId: 'pm-kisan',
    schemeName: 'PM-KISAN Samman Nidhi',
    section: 'Benefits',
    sourceFile: 'pm-kisan.md',
    text: 'PM-KISAN: eligible landholding farmer families receive ₹6,000 per year in three equal instalments.',
    tokens: 20,
  };
  const vectors = await embedTexts([chunk.text], {
    kind: 'document',
    model: 'fake-embed',
    dimensions: 3,
  });
  setKnowledgeBase(
    new VectorStore(
      buildVectorStoreFile(
        {
          version: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          embedModel: 'fake-embed',
          dimensions: 3,
          sourceFingerprint: 'fake',
          chunking: DEFAULT_CHUNKING,
          documents: [],
        },
        [chunk],
        vectors,
      ),
    ),
  );
}

function expectError(
  id: string,
  title: string,
  result: { status: number; body: unknown },
  status: number,
  code: string,
  via: string,
): Check {
  const got = errorCode(result as never);
  const ok = result.status === status && got === code;
  return {
    id,
    title,
    status: ok ? 'PASS' : 'FAIL',
    detail: `Expected ${status} ${code}; got ${result.status} ${got ?? '(no error code)'} (${via}, fake Gemini backend).`,
    evidence: ['scripts/audit/fakeWorker.ts'],
  };
}

async function stageI(transport: Transport): Promise<StageResult> {
  return runStage('I', 'Robustness and error codes', 'fake-backend', async () => {
    const checks: Check[] = [];
    const via = transport.kind === 'http' ? 'real Express app' : 'controllers called directly';

    checks.push(
      expectError(
        'I-empty-audio',
        'Voice request without audio',
        await transport.voice({ sessionId: sessionId('i') }, null),
        400,
        'AUDIO_REQUIRED',
        via,
      ),
    );

    scenario.transcript = '';
    checks.push(
      expectError(
        'I-silent-audio',
        'Silent audio (STT returns no speech)',
        await transport.voice(
          { sessionId: sessionId('i') },
          { bytes: silentWav(1000), mimeType: 'audio/wav', fileName: 'silence.wav' },
        ),
        422,
        'NO_SPEECH_DETECTED',
        via,
      ),
    );
    scenario.transcript = QUESTION_HI;

    if (transport.kind === 'http') {
      checks.push(
        expectError(
          'I-oversized-audio',
          'Audio over the 10 MB limit',
          await transport.voice(
            { sessionId: sessionId('i') },
            { bytes: Buffer.alloc(11 * 1024 * 1024), mimeType: 'audio/wav', fileName: 'big.wav' },
          ),
          413,
          'LIMIT_FILE_SIZE',
          via,
        ),
      );
      checks.push(
        expectError(
          'I-wrong-mime',
          'Non-audio upload',
          await transport.voice(
            { sessionId: sessionId('i') },
            { bytes: Buffer.from('hello'), mimeType: 'text/plain', fileName: 'note.txt' },
          ),
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          via,
        ),
      );
    } else {
      for (const [id, title] of [
        ['I-oversized-audio', 'Audio over the 10 MB limit'],
        ['I-wrong-mime', 'Non-audio upload'],
      ]) {
        checks.push({
          id,
          title,
          status: 'NOT-TESTED',
          detail: `Enforced by multer inside the Express app, which could not be started here (${transport.note}).`,
          evidence: ['server/src/middleware/upload.ts'],
        });
      }
    }

    // Rate limiter: the middleware itself, three requests against a limit of two.
    const limiter = rateLimit(2);
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (name: string, value: string) => void (headers[name.toLowerCase()] = value),
    } as unknown as Response;
    const errors: unknown[] = [];
    for (let i = 0; i < 3; i++) {
      limiter({ ip: '203.0.113.9' } as Request, res, (error?: unknown) => errors.push(error));
    }
    const third = errors[2];
    const limited =
      third instanceof HttpError &&
      third.status === 429 &&
      third.code === 'RATE_LIMITED' &&
      Boolean(headers['retry-after']);
    checks.push({
      id: 'I-rate-limit',
      title: 'Per-IP rate limit reached',
      status: limited ? 'PASS' : 'FAIL',
      detail: limited
        ? `Third request in the window got 429 RATE_LIMITED with Retry-After ${headers['retry-after']} s.`
        : `Unexpected: ${String(third)}`,
      evidence: ['server/src/middleware/rateLimit.ts'],
    });

    scenario.failWith = { name: 'TimeoutError', message: 'fake timeout' };
    checks.push(
      expectError(
        'I-gemini-timeout',
        'Gemini timeout on a text question',
        await transport.chat({ text: QUESTION_HI, language: 'hi', sessionId: sessionId('i') }),
        504,
        'AI_TIMEOUT',
        via,
      ),
    );
    scenario.failWith = { status: 429, message: 'fake quota exceeded' };
    checks.push(
      expectError(
        'I-gemini-429',
        'Gemini 429 on a text question',
        await transport.chat({ text: QUESTION_HI, language: 'hi', sessionId: sessionId('i') }),
        429,
        'AI_RATE_LIMITED',
        via,
      ),
    );
    scenario.failWith = undefined;

    setGeminiBackend(undefined);
    checks.push(
      expectError(
        'I-missing-key',
        'Real mode without GEMINI_API_KEY',
        await transport.chat({ text: QUESTION_HI, language: 'hi', sessionId: sessionId('i') }),
        503,
        'AI_NOT_CONFIGURED',
        via,
      ),
    );
    setGeminiBackend(fakeBackend);

    const ttsFailure = await synthesizeSpeech(
      { text: 'नमस्ते', language: 'hi' },
      {
        fetcher: async () => new Response('unavailable', { status: 503 }),
        model: 'fake-tts',
        apiKey: 'fake-key',
      },
    );
    checks.push({
      id: 'I-tts-provider-error',
      title: 'TTS provider error falls back to browser speech',
      status: ttsFailure.audioUrl === null ? 'PASS' : 'FAIL',
      detail: `synthesizeSpeech with a provider answering 503 returned audioUrl ${ttsFailure.audioUrl === null ? 'null (client uses browser speech)' : 'non-null'}.`,
      evidence: ['server/src/modules/tts/service.ts'],
    });

    checks.push({
      id: 'I-ui-path',
      title: 'Friendly, localized error message in the client',
      status: 'NOT-TESTED',
      detail:
        'The client (ChatProvider errorText) is not exercised by this server-side audit, and no client test runner exists for it.',
      evidence: ['client/src/features/chat/ChatProvider.tsx'],
    });
    return { checks };
  });
}

/** The conversation module uses one label for two steps; name them by their prompt. */
function stepName(call: GeminiCallRecord): string {
  if (call.label !== 'conversation') return call.label;
  if (call.system?.startsWith('You are the front door')) return 'understand';
  if (call.system?.startsWith('You answer a question')) return 'answer';
  return call.label;
}

async function stageJShape(transport: Transport, calls: GeminiCallRecord[]): Promise<StageResult> {
  return runStage('J', 'Latency and cost shape', 'fake-backend', async () => {
    const checks: Check[] = [];
    const measure = async (id: string, title: string, run: () => Promise<{ status: number }>) => {
      clearAnswerCache();
      clearConversationHistory();
      const before = calls.length;
      const result = await run();
      const own = calls.slice(before);
      const depth = sequentialDepth(own);
      const labels = own.map((call) => stepName(call));
      const counts = labels.reduce<Record<string, number>>(
        (all, label) => ({ ...all, [label]: (all[label] ?? 0) + 1 }),
        {},
      );
      checks.push({
        id,
        title,
        status: result.status !== 200 ? 'FAIL' : depth > MAX_SEQUENTIAL_CALLS ? 'FAIL' : 'PASS',
        detail: `${own.length} Gemini call(s) (${
          Object.entries(counts)
            .map(([label, n]) => `${label}×${n}`)
            .join(', ') || 'none'
        }), ${depth} sequential. ${depth > MAX_SEQUENTIAL_CALLS ? `FLAGGED: more than ${MAX_SEQUENTIAL_CALLS} sequential calls, so real latency adds up across them.` : `Within the ${MAX_SEQUENTIAL_CALLS}-sequential-call budget.`} HTTP ${result.status}. Shape measured with a fake backend; real latency is in the live part of Stage J.`,
        evidence: ['scripts/audit/fakeWorker.ts'],
        data: { calls: own.length, sequential: depth, labels: counts },
      });
    };
    await measure('J-shape-text-scheme', 'Typed scheme question', () =>
      transport.chat({ text: QUESTION_HI, language: 'hi', sessionId: sessionId('j') }),
    );
    await measure('J-shape-text-dialect', 'Typed scheme question with dialectHint (bhojpuri)', () =>
      transport.chat({
        text: QUESTION_HI,
        language: 'hi',
        dialectHint: 'bhojpuri',
        sessionId: sessionId('j'),
      }),
    );
    await measure('J-shape-text-clarify', 'Typed clarification (“ki keh raho he”)', () =>
      transport.chat({ text: 'ki keh raho he', language: 'hi', sessionId: sessionId('j') }),
    );
    await measure('J-shape-voice', 'Spoken scheme question (dialect identification on)', () =>
      transport.voice(
        { sessionId: sessionId('j') },
        { bytes: silentWav(1000), mimeType: 'audio/wav', fileName: 'q.wav' },
      ),
    );
    let ttsCalls = 0;
    await measure('J-shape-tts', 'Listen (server speech)', async () => {
      await synthesizeSpeech(
        { text: 'नमस्ते', language: 'hi' },
        {
          fetcher: async () => {
            ttsCalls += 1;
            return new Response(JSON.stringify({ output_audio: { data: 'AQID' } }), {
              status: 200,
            });
          },
          model: 'fake-tts',
          apiKey: 'fake-key',
        },
      );
      return { status: 200 };
    });
    const tts = checks.at(-1);
    if (tts && tts.id === 'J-shape-tts' && ttsCalls > 0 && (tts.data?.calls ?? 0) === 0) {
      tts.detail = `${ttsCalls} provider call(s) made with fetch outside the Gemini client (not counted by the call observer), 1 sequential. Within the budget.`;
      tts.data = { calls: ttsCalls, sequential: 1, labels: { 'tts (fetch)': ttsCalls } };
    }
    return { checks };
  });
}

async function main(): Promise<void> {
  const [outFile] = process.argv.slice(2);
  if (!outFile) throw new Error('usage: fakeWorker.ts <out.json>');
  if (env.GEMINI_API_KEY) throw new Error('fake worker must run without GEMINI_API_KEY');
  const calls: GeminiCallRecord[] = [];
  setGeminiBackend(fakeBackend);
  await installFakeKnowledgeBase();
  setGeminiObserver((record) => calls.push(record));
  const transport = await openTransport();
  const stages: StageResult[] = [];
  try {
    stages.push(await stageI(transport));
    stages.push(await stageJShape(transport, calls));
  } finally {
    await transport.close();
  }
  const output: WorkerOutput = {
    worker: 'fake',
    environment: {
      useMocks: [...env.USE_MOCKS],
      keyConfigured: false,
      transport: transport.kind,
      transportNote: transport.note,
      models: { chat: env.GEMINI_CHAT_MODEL, tts: env.GEMINI_TTS_MODEL },
    },
    stages,
    regional: [],
  };
  writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf8');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
