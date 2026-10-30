import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { logger } from '../lib/logger';

const serverRoot = path.resolve(__dirname, '../..');

// One .env at the repo root serves both apps (see .env.example). An optional server/.env
// overrides it, and real environment variables (e.g. set by the host) override both.
// Tests set their own variables and must not pick up a developer's .env.
if (process.env.NODE_ENV !== 'test') {
  loadDotenv({
    path: [path.join(serverRoot, '.env'), path.join(serverRoot, '../.env')],
    quiet: true,
  });
}

/** Files and folders the server reads, resolved from this file so any working directory works. */
export const PATHS = {
  schemes: path.resolve(serverRoot, '../data/schemes'),
  eligibility: path.resolve(serverRoot, '../data/eligibility'),
  dialects: path.resolve(serverRoot, '../data/dialects/registry.json'),
  dialectExemplars: path.resolve(serverRoot, '../data/dialects/exemplars'),
  dialectTestset: path.resolve(serverRoot, '../data/eval/dialect/testset.jsonl'),
  dialectAudio: path.resolve(serverRoot, '../data/eval/dialect/audio'),
  dialectCalibration: path.resolve(serverRoot, '../data/dialects/calibration.json'),
  faqSeeds: path.resolve(serverRoot, '../data/faq/questions.json'),
  vectorStore: path.join(serverRoot, 'data/vectorstore.json'),
  faq: path.join(serverRoot, 'data/faq.json'),
};

/** Modules that can serve mock data. */
export const MOCKABLE_MODULES = [
  'voice',
  'chat',
  'dialect',
  'rag',
  'eligibility',
  'sms',
  'tts',
  'faq',
] as const;
export type MockableModule = (typeof MOCKABLE_MODULES)[number];

/** USE_MOCKS is `true`, `false` or a comma-separated list such as `eligibility,sms`. */
function parseMockList(raw: string, ctx: z.RefinementCtx): ReadonlySet<MockableModule> {
  const value = raw.trim().toLowerCase();
  if (['true', '1', 'yes', 'all'].includes(value)) return new Set(MOCKABLE_MODULES);
  if (['false', '0', 'no', 'none'].includes(value)) return new Set();

  const names = value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const unknown = names.filter((name) => !(MOCKABLE_MODULES as readonly string[]).includes(name));
  if (unknown.length > 0) {
    ctx.addIssue({
      code: 'custom',
      message: `unknown module(s) "${unknown.join(', ')}". Use true, false or a list of: ${MOCKABLE_MODULES.join(', ')}`,
    });
    return z.NEVER;
  }
  return new Set(names as MockableModule[]);
}

/** Treats `KEY=` (empty value) like an unset variable so the default applies. */
const fromEnv = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema);

const envSchema = z.object({
  NODE_ENV: fromEnv(z.enum(['development', 'test', 'production']).default('development')),
  PORT: fromEnv(z.coerce.number().int().min(1).max(65535).default(4000)),
  USE_MOCKS: fromEnv(z.string().default('true').transform(parseMockList)),
  CLIENT_ORIGIN: fromEnv(z.string().default('http://localhost:5173')),
  /** Read by lib/logger directly; validated here. Default: debug (dev), info (production). */
  LOG_LEVEL: fromEnv(z.enum(['debug', 'info', 'warn', 'error']).optional()),

  // Gemini. Model ids: https://ai.google.dev/gemini-api/docs/models
  GEMINI_API_KEY: fromEnv(z.string().optional()),
  GEMINI_CHAT_MODEL: fromEnv(z.string().default('gemini-3.8-flash')),
  /** Model for speech-to-text; defaults to GEMINI_CHAT_MODEL. */
  GEMINI_AUDIO_MODEL: fromEnv(z.string().optional()),
  GEMINI_EMBED_MODEL: fromEnv(z.string().default('gemini-embedding-2')),
  GEMINI_EMBED_DIMENSIONS: fromEnv(z.coerce.number().int().min(128).max(3072).default(768)),
  /** `default` sends no thinking level and lets the model decide. */
  GEMINI_THINKING_LEVEL: fromEnv(
    z.enum(['minimal', 'low', 'medium', 'high', 'default']).default('low'),
  ),
  GEMINI_TIMEOUT_MS: fromEnv(z.coerce.number().int().min(1000).max(300_000).default(30_000)),
  GEMINI_MAX_RETRIES: fromEnv(z.coerce.number().int().min(0).max(8).default(3)),
  /** Shared cap for Gemini generation and embedding calls; one slot stays available to answers. */
  GEMINI_MAX_CONCURRENT_CALLS: fromEnv(z.coerce.number().int().min(2).max(64).default(8)),

  // Dialect classification. A smaller dialect active set means higher accuracy.
  DIALECT_ENSEMBLE_SIZE: fromEnv(z.coerce.number().int().min(1).max(3).default(3)),
  DIALECT_MIN_VOTES: fromEnv(z.coerce.number().int().min(1).max(3).default(2)),
  DIALECT_TIMEOUT_MS: fromEnv(z.coerce.number().int().min(100).max(300_000).default(6000)),
  DIALECT_TEXT_DETECT: fromEnv(z.stringbool().default(false)),
  DIALECT_ACTIVE: fromEnv(z.string().trim().default('all')),
  DIALECT_EXEMPLARS_PER_LABEL: fromEnv(z.coerce.number().int().min(0).max(20).default(4)),
  DIALECT_EXEMPLAR_TOKEN_BUDGET: fromEnv(z.coerce.number().int().min(0).max(20_000).default(1800)),

  // Retrieval
  RAG_TOP_K: fromEnv(z.coerce.number().int().min(1).max(10).default(4)),
  /** Cosine similarity below which a chunk is ignored; no chunk left means "not found". */
  RAG_MIN_SCORE: fromEnv(z.coerce.number().min(0).max(1).default(0.5)),
  /** Translate non-English questions to English before embedding them. */
  RAG_TRANSLATE_QUERY: fromEnv(z.stringbool().default(false)),

  // Answer cache and SMS
  CACHE_MAX_ENTRIES: fromEnv(z.coerce.number().int().min(0).max(100_000).default(500)),
  /** 0 = entries never expire (they are still evicted when the cache is full). */
  CACHE_TTL_MINUTES: fromEnv(z.coerce.number().min(0).default(360)),
  SMS_MAX_SEGMENTS: fromEnv(z.coerce.number().int().min(1).max(10).default(2)),

  // Abuse protection
  /** Requests per minute per IP to the AI endpoints; 0 = no limit. */
  RATE_LIMIT_PER_MINUTE: fromEnv(z.coerce.number().int().min(0).default(30)),
  /** Express `trust proxy`: hops of proxies in front of the server (1 on Vercel). */
  TRUST_PROXY: fromEnv(z.coerce.number().int().min(0).max(10).default(1)),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  logger.error(`Invalid environment variables (check .env):\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}

export const env = parsed.data;

/** Calibration is the fallback; explicitly set env values always take precedence. */
export const dialectEnvOverrides = {
  ensembleSize:
    process.env.DIALECT_ENSEMBLE_SIZE !== undefined && process.env.DIALECT_ENSEMBLE_SIZE !== '',
  minimumVotes: process.env.DIALECT_MIN_VOTES !== undefined && process.env.DIALECT_MIN_VOTES !== '',
} as const;

/** True when `module` should serve mock data instead of calling AI services. */
export function isMocked(module: MockableModule): boolean {
  return env.USE_MOCKS.has(module);
}

export function describeMocks(): string {
  if (env.USE_MOCKS.size === MOCKABLE_MODULES.length) return 'all modules';
  return env.USE_MOCKS.size === 0 ? 'off' : [...env.USE_MOCKS].join(', ');
}
