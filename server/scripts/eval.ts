import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { LanguageCode, QueryResponse } from '@gram-saathi/shared';
import { env } from '../src/config/env';
import { answerQuestion } from '../src/modules/chat/service';
import { handleTurn, type Deps, type Lang, type Passage } from '../src/modules/chat/conversation';

export interface EvalSet {
  schemeQuestions: { id: string; question: string; schemeId: string }[];
  languages: Record<Lang, { expectedScript: 'devanagari' | 'tamil' | 'latin' }>;
  nonSchemeMessages: { id: string; text: string; language: Lang; expectedIntent: 'smalltalk' | 'clarify' | 'out_of_scope' }[];
}

export interface EvalRow { id: string; language: Lang; passed: boolean; checks: string[]; }
export const evalSet = JSON.parse(readFileSync(path.resolve(__dirname, '../eval/testset.json'), 'utf8')) as EvalSet;

export async function offlineRows(): Promise<EvalRow[]> {
  const rows: EvalRow[] = [];
  for (const language of Object.keys(evalSet.languages) as Lang[]) {
    for (const item of evalSet.schemeQuestions) {
      let searches = 0;
      const passage: Passage = {
        id: item.schemeId,
        schemeName: item.schemeId,
        section: 'plumbing fixture',
        text: 'Fixture passage for offline plumbing only.',
        score: 1,
      };
      const deps: Deps = {
        minScore: 0.5,
        search: async () => { searches++; return [passage]; },
        generateJson: async <T>({ prompt }: { system: string; prompt: string }) => {
          const isUnderstand = prompt.includes('Recent conversation:');
          return (isUnderstand
            ? { intent: 'scheme_question', language, dialect: null, searchQueryEn: item.question, reply: '' }
            : { answersQuestion: true, answer: 'fixture answer', usedChunkIds: [item.schemeId] }) as T;
        },
      };
      const result = await handleTurn(deps, { text: item.question, history: [], languageHint: language });
      const passed = result.kind === 'grounded' && result.usedChunkIds.includes(item.schemeId) && searches === 1;
      const checks = passed ? ['grounded route, expected citation, one retrieval'] : ['routing, citation, or retrieval plumbing'];
      rows.push({ id: item.id, language, passed, checks });
    }
  }

  for (const item of evalSet.nonSchemeMessages) {
    let searches = 0;
    const deps: Deps = {
      minScore: 0.5,
      search: async () => { searches++; return []; },
      generateJson: async <T>() => ({
        intent: item.expectedIntent, language: item.language, dialect: null, searchQueryEn: '', reply: 'fixture direct reply',
      }) as T,
    };
    const result = await handleTurn(deps, { text: item.text, history: [] });
    const passed = result.kind === 'direct' && result.intent === item.expectedIntent && searches === 0;
    rows.push({ id: item.id, language: item.language, passed, checks: [passed ? 'direct route, expected intent, no retrieval' : 'intent or retrieval plumbing'] });
  }
  return rows;
}

export async function liveRows(): Promise<EvalRow[]> {
  const rows: EvalRow[] = [];
  for (const language of Object.keys(evalSet.languages) as Lang[]) {
    for (const item of evalSet.schemeQuestions) {
      const response = await safeAnswer(item.question, language);
      const checks = response ? checkGrounded(response, item.schemeId, evalSet.languages[language].expectedScript) : ['request failed'];
      rows.push({ id: item.id, language, passed: checks.length === 0, checks });
    }
  }
  for (const item of evalSet.nonSchemeMessages) {
    const response = await safeAnswer(item.text, item.language);
    const checks = response?.intent === item.expectedIntent ? [] : [`intent expected ${item.expectedIntent}, got ${response?.intent ?? 'none'}`];
    rows.push({ id: item.id, language: item.language, passed: checks.length === 0, checks });
  }
  return rows;
}

async function safeAnswer(text: string, language: Lang): Promise<QueryResponse | undefined> {
  try {
    return await answerQuestion({ text, language: language as LanguageCode, sessionId: `eval-${Date.now()}-${Math.random()}` });
  } catch {
    return undefined;
  }
}

function checkGrounded(response: QueryResponse, expectedSchemeId: string, expectedScript: string): string[] {
  const failures: string[] = [];
  if (response.intent !== 'scheme_question') failures.push(`intent ${response.intent ?? 'missing'}`);
  if (response.notFound || !response.sources.some((source) => source.schemeId === expectedSchemeId)) failures.push(`missing expected scheme ${expectedSchemeId}`);
  const cited = response.sources;
  for (const amount of response.answer.match(/₹\s*[0-9०-९][0-9०-९,]*(?:\.[0-9]+)?|[0-9०-९][0-9०-९,]*(?:\.[0-9]+)?/gu) ?? []) {
    if (!cited.some((source) => source.snippet.includes(amount))) failures.push(`unsupported number ${amount}`);
  }
  if (expectedScript === 'devanagari' && !/[\u0900-\u097f]/u.test(response.answer)) failures.push('missing Devanagari script');
  if (expectedScript === 'tamil' && !/[\u0b80-\u0bff]/u.test(response.answer)) failures.push('missing Tamil script');
  if (expectedScript !== 'latin') {
    let scriptCheck = response.answer.replace(/https?:\/\/\S+/gu, '');
    for (const source of cited) {
      scriptCheck = scriptCheck.replaceAll(source.schemeName, '').replaceAll(source.schemeName.split(/\s+/u)[0], '');
    }
    if (/[A-Za-z]/u.test(scriptCheck)) failures.push('Roman text outside preserved scheme names/URLs');
  }
  return failures;
}

export function printRows(mode: string, rows: EvalRow[]): void {
  console.log(`\n${mode} evaluation`);
  console.log('Result  Language  Case                         Checks');
  for (const row of rows) console.log(`${row.passed ? 'PASS' : 'FAIL'}    ${row.language.padEnd(8)}  ${row.id.padEnd(28)} ${row.checks.join('; ') || 'all checks passed'}`);
  const passed = rows.filter((row) => row.passed).length;
  console.log(`Summary: ${passed}/${rows.length} passed, ${rows.length - passed} failed.`);
}

async function main(): Promise<void> {
  const mode = process.env.EVAL_MODE?.toLowerCase() === 'live' ? 'live' : 'offline';
  if (mode === 'live' && !env.GEMINI_API_KEY) {
    console.log('Live evaluation skipped: GEMINI_API_KEY is not configured.');
    console.log('Use EVAL_MODE=live npm run eval -w server after building a verified vector store.');
    return;
  }
  const rows = mode === 'live' ? await liveRows() : await offlineRows();
  printRows(mode, rows);
  if (mode === 'offline' && rows.some((row) => !row.passed)) process.exitCode = 1;
  // Live model quality is advisory and never controls the build exit code.
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/eval.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
