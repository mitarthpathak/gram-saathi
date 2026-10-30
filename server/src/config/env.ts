import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { logger } from '../lib/logger';

// One .env at the repo root serves both apps (see .env.example). An optional server/.env
// overrides it, and real environment variables (e.g. set by the host) override both.
const serverRoot = path.resolve(__dirname, '../..');
loadDotenv({
  path: [path.join(serverRoot, '.env'), path.join(serverRoot, '../.env')],
  quiet: true,
});

/** Modules that can serve mock data. */
export const MOCKABLE_MODULES = [
  'voice',
  'chat',
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
  GEMINI_API_KEY: fromEnv(z.string().optional()),
  GEMINI_CHAT_MODEL: fromEnv(z.string().default('gemini-flash-latest')),
  GEMINI_EMBED_MODEL: fromEnv(z.string().default('gemini-embedding-001')),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  logger.error(`Invalid environment variables (check .env):\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}

export const env = parsed.data;

/** True when `module` should serve mock data instead of calling AI services. */
export function isMocked(module: MockableModule): boolean {
  return env.USE_MOCKS.has(module);
}

export function describeMocks(): string {
  if (env.USE_MOCKS.size === MOCKABLE_MODULES.length) return 'all modules';
  return env.USE_MOCKS.size === 0 ? 'off' : [...env.USE_MOCKS].join(', ');
}

if (env.USE_MOCKS.size < MOCKABLE_MODULES.length && !env.GEMINI_API_KEY) {
  // TODO(step-2): make this a startup error once the real Gemini calls exist.
  logger.warn(
    'Some modules run without mocks but GEMINI_API_KEY is empty: their AI calls will fail.',
  );
}
