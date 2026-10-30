/**
 * Asks one question from the terminal and prints what the API would return.
 *
 *   npm run query -w server -- "PM Kisan ke liye kaun eligible hai?"
 *   npm run query -w server -- "How do I get an Ayushman card?" --lang en --json
 *
 * Uses the same settings as the server (.env): with USE_MOCKS=true you get the mock answers.
 */
import type { LanguageCode } from '@gram-saathi/shared';
import { env, isMocked } from '../src/config/env';
import { HttpError } from '../src/lib/httpError';
import { isLanguageCode } from '../src/lib/languages';
import { detectTextLanguage } from '../src/modules/chat/language';
import { answerQuestion } from '../src/modules/chat/service';
import { searchSchemes } from '../src/modules/rag/service';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const langIndex = args.indexOf('--lang');
  const hint = langIndex >= 0 ? args[langIndex + 1] : undefined;
  if (hint !== undefined && !isLanguageCode(hint))
    throw new Error(`--lang must be one of hi, mr, ta, en`);
  const question = args
    .filter((arg, index) => !arg.startsWith('--') && index !== langIndex + 1)
    .join(' ')
    .trim();
  if (!question)
    throw new Error('Usage: npm run query -w server -- "your question" [--lang hi] [--json]');

  const language = hint as LanguageCode | undefined;
  const startedAt = Date.now();
  const response = await answerQuestion({ text: question, language, sessionId: 'cli' });
  const elapsed = Date.now() - startedAt;

  if (json) {
    console.log(JSON.stringify(response, null, 2));
    return;
  }

  console.log(`Question  ${question}`);
  console.log(
    `Language  ${response.detectedLanguage}${isMocked('chat') ? '   (USE_MOCKS: mock answer)' : ''}`,
  );
  if (!isMocked('rag')) {
    // Same search the answer used (embeddings are deterministic): shows how close each passage was.
    const retrieved = await searchSchemes({
      query: question,
      language: detectTextLanguage(question, language),
    });
    console.log(`\nRetrieved (RAG_MIN_SCORE ${env.RAG_MIN_SCORE})`);
    for (const chunk of retrieved) {
      const mark = chunk.score >= env.RAG_MIN_SCORE ? '+' : '-';
      console.log(`  ${mark} ${chunk.score.toFixed(3)}  ${chunk.chunkId}`);
    }
  }
  console.log(
    `\nAnswer${response.notFound ? ' (NOT FOUND in the documents)' : ''}\n  ${response.answer}`,
  );
  console.log('\nSources');
  if (response.sources.length === 0) console.log('  (none)');
  for (const source of response.sources) {
    console.log(`  - ${source.schemeName} > ${source.section}: "${source.snippet}"`);
  }
  console.log(
    `\nSMS (${response.smsSegments} segment(s), ${response.smsText.length} chars)\n  ${response.smsText}`,
  );
  console.log(`\nFraud warning\n  ${response.fraudWarning}`);
  console.log(`\n${elapsed} ms${response.usedCache ? ', from cache' : ''}`);
}

main().catch((error: unknown) => {
  if (error instanceof HttpError) console.error(`${error.status} ${error.code}: ${error.message}`);
  else console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
