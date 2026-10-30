/**
 * Answers the questions in data/faq/questions.json ahead of time and writes
 * server/data/faq.json, which feeds GET /api/faq/top (offline / low-bandwidth mode) and the
 * answer cache. Needs the knowledge base (`npm run ingest`) and GEMINI_API_KEY.
 *
 *   npm run prewarm -w server                       all languages
 *   npm run prewarm -w server -- --lang hi,en       only these (keeps the others from the file)
 *   npm run prewarm -w server -- --concurrency 2    fewer parallel requests (rate limits)
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { LanguageCode } from '@gram-saathi/shared';
import { z } from 'zod';
import { env, isMocked, PATHS } from '../src/config/env';
import { isGeminiConfigured } from '../src/lib/geminiClient';
import { isLanguageCode, LANGUAGE_CODES } from '../src/lib/languages';
import { answerQuestion, type CachedAnswer } from '../src/modules/chat/service';
import { type FaqFile, faqFileSchema } from '../src/modules/faq/service';
import { getKnowledgeBase } from '../src/modules/rag/service';

const relative = (file: string) => path.relative(process.cwd(), file) || file;

const seedsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      question: z.partialRecord(z.enum(LANGUAGE_CODES), z.string().trim().min(1)),
    }),
  ),
});

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

/** Runs `fn` over `items`, at most `limit` at a time, keeping the order of results. */
async function mapLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const languages = (flag(args, '--lang')?.split(',') ?? LANGUAGE_CODES).map((code) => code.trim());
  const invalid = languages.filter((code) => !isLanguageCode(code));
  if (invalid.length > 0) throw new Error(`Unknown language(s): ${invalid.join(', ')}`);
  const concurrency = Number(flag(args, '--concurrency') ?? 3);
  if (!Number.isInteger(concurrency) || concurrency < 1)
    throw new Error('--concurrency needs a positive integer');

  if (isMocked('chat') || isMocked('rag')) {
    throw new Error(
      'prewarm makes real answers: run it with USE_MOCKS=false (or without chat and rag).',
    );
  }
  if (!isGeminiConfigured()) throw new Error('GEMINI_API_KEY is not set.');
  const store = getKnowledgeBase();
  if (!store)
    throw new Error(
      `No knowledge base at ${relative(PATHS.vectorStore)}: run \`npm run ingest -w server\` first.`,
    );

  const { items } = seedsSchema.parse(JSON.parse(readFileSync(PATHS.faqSeeds, 'utf8')));
  const previous: FaqFile['languages'] = existsSync(PATHS.faq)
    ? faqFileSchema.parse(JSON.parse(readFileSync(PATHS.faq, 'utf8'))).languages
    : {};

  const output: FaqFile = {
    version: 1,
    createdAt: new Date().toISOString(),
    chatModel: env.GEMINI_CHAT_MODEL,
    sourceFingerprint: store.meta.sourceFingerprint,
    languages: { ...previous },
  };

  for (const language of languages as LanguageCode[]) {
    const questions = items.flatMap(({ id, question }) => {
      const text = question[language];
      return text ? [{ id, question: text }] : [];
    });
    console.log(`${language}: answering ${questions.length} questions...`);

    const answered = await mapLimited(questions, concurrency, async ({ id, question }) => {
      const response = await answerQuestion({
        text: question,
        detectedLanguage: language,
        sessionId: 'prewarm',
      });
      const {
        sessionId: _session,
        transcript: _transcript,
        usedCache: _cached,
        ...answer
      } = response;
      const status = answer.notFound ? 'NOT FOUND (left out)' : `${answer.sources.length} sources`;
      console.log(`  ${id.padEnd(22)} ${status}`);
      return { id, question, answer: answer satisfies CachedAnswer };
    });
    output.languages[language] = answered.filter(({ answer }) => !answer.notFound);
  }

  await mkdir(path.dirname(PATHS.faq), { recursive: true });
  await writeFile(PATHS.faq, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`\nWrote ${relative(PATHS.faq)}. Restart the server to serve the new answers.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
