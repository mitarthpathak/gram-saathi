/** Stages B (real-mode preflight), C (retrieval), D (text answers) and E (dialect text). */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { LanguageCode, QueryResponse } from '@gram-saathi/shared';
import { z } from 'zod';
import { env, isMocked, PATHS } from '../../src/config/env';
import {
  describeFacts,
  extractFacts,
  hasFacts,
  missingFacts,
  type Facts,
} from '../../src/lib/facts';
import { embedTexts, generateJson } from '../../src/lib/geminiClient';
import { getDialectRegistry } from '../../src/modules/dialect/registry';
import {
  fingerprintDocuments,
  loadSchemeDocuments,
  verifiedOfficialDocuments,
} from '../../src/modules/rag/documents';
import { searchSchemes } from '../../src/modules/rag/service';
import { synthesizeSpeech } from '../../src/modules/tts/service';
import { recommendThreshold } from '../calibrate-rag';
import {
  distribution,
  excerpt,
  expectedScript,
  formatDistribution,
  romanWords,
  scriptCounts,
  toCsv,
} from './checks';
import {
  asMode,
  mockedModulesText,
  NO_KEY_REASON,
  runStage,
  sessionId,
  stageMode,
  type WorkerContext,
} from './context';
import { AUDIT_LANGUAGES, type GoldQuestion } from './goldset';
import { sourceMatchesKb, supportedFacts } from './kb';
import { errorCode, isErrorBody, type ApiResult } from './transport';
import type { Check, StageResult, Status } from './types';

const TEXT_PRIORITY = [
  'pm-kisan-amount',
  'pmjay-cover',
  'mgnrega-days',
  'apy-pension',
  'ujjwala-who',
  'pmsby-cover',
  'pm-kisan-register',
  'pmjay-card',
  'apy-who',
  'mgnrega-job-card',
  'pm-kisan-eligibility',
];

function textCasesPerLanguage(): number {
  const raw = Number(process.env.AUDIT_TEXT_PER_LANGUAGE ?? 3);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, TEXT_PRIORITY.length) : 3;
}

const schemeNames = (ctx: WorkerContext) => ctx.kb.documents.map((document) => document.schemeName);

// ---------------------------------------------------------------------------
// Stage B: real-mode preflight
// ---------------------------------------------------------------------------

export function stageB(ctx: WorkerContext): Promise<StageResult> {
  return runStage('B', 'Real-mode preflight', env.GEMINI_API_KEY ? 'real' : 'static', async () => {
    const checks: Check[] = [];
    checks.push({
      id: 'B-env',
      title: 'Environment variables validate',
      status: 'PASS',
      detail:
        'server/src/config/env.ts parsed the environment (it exits the process on invalid values, so reaching this line is the evidence).',
      evidence: ['server/src/config/env.ts'],
      data: {
        useMocks: [...env.USE_MOCKS],
        keyConfigured: Boolean(env.GEMINI_API_KEY),
      },
    });

    const key = Boolean(env.GEMINI_API_KEY);
    const modelCheck = async (
      id: string,
      title: string,
      model: string | undefined,
      run: (model: string) => Promise<string>,
    ) => {
      if (!model) {
        checks.push({
          id,
          title,
          status: 'NOT-TESTED',
          detail: 'No model configured for this role.',
          evidence: [],
        });
        return;
      }
      if (!key) {
        checks.push({
          id,
          title,
          status: 'NOT-TESTED',
          detail: `${NO_KEY_REASON} Model id "${model}" was not resolved.`,
          evidence: [],
        });
        return;
      }
      try {
        const detail = await run(model);
        checks.push({
          id,
          title,
          status: 'PASS',
          detail: `"${model}" answered a minimal call: ${detail}`,
          evidence: ['minimal live call from scripts/audit'],
        });
      } catch (error) {
        checks.push({
          id,
          title,
          status: 'FAIL',
          detail: `"${model}" failed a minimal call: ${error instanceof Error ? error.message.slice(0, 240) : String(error)}`,
          evidence: ['minimal live call from scripts/audit'],
        });
      }
    };
    const ping = (model: string) =>
      generateJson({
        label: 'audit-preflight',
        model,
        input: 'Return JSON {"ok": true}.',
        schema: z.object({ ok: z.boolean() }),
        maxOutputTokens: 512,
        maxRetries: 0,
      }).then((result) => `ok=${String(result.ok)}`);
    await modelCheck('B-model-chat', 'Chat model id resolves', env.GEMINI_CHAT_MODEL, ping);
    await modelCheck(
      'B-model-fallback',
      'Fallback model id resolves',
      env.GEMINI_FALLBACK_MODEL.toLowerCase() === 'none' ? undefined : env.GEMINI_FALLBACK_MODEL,
      ping,
    );
    await modelCheck(
      'B-model-audio',
      'Speech-to-text model id resolves (text-only ping)',
      env.GEMINI_AUDIO_MODEL ?? env.GEMINI_CHAT_MODEL,
      ping,
    );
    await modelCheck(
      'B-model-embed',
      'Embedding model id resolves',
      env.GEMINI_EMBED_MODEL,
      async (model) => {
        const [vector] = await embedTexts(['audit preflight'], {
          kind: 'query',
          model,
          maxRetries: 0,
        });
        if (vector.length !== env.GEMINI_EMBED_DIMENSIONS) {
          throw new Error(
            `returned ${vector.length} dimensions, GEMINI_EMBED_DIMENSIONS is ${env.GEMINI_EMBED_DIMENSIONS}`,
          );
        }
        return `${vector.length} dimensions`;
      },
    );
    if (isMocked('tts')) {
      checks.push({
        id: 'B-model-tts',
        title: 'Text-to-speech model id resolves',
        status: 'NOT-TESTED',
        detail: 'tts is mocked (USE_MOCKS), so no TTS call was made.',
        evidence: [],
      });
    } else
      await modelCheck(
        'B-model-tts',
        'Text-to-speech model id resolves',
        env.GEMINI_TTS_MODEL,
        async () => {
          const result = await synthesizeSpeech({ text: 'नमस्ते', language: 'hi' });
          if (!result.audioUrl)
            throw new Error('no audio returned (provider error, timeout or unsupported model)');
          return `audio returned (${Math.round(result.audioUrl.length / 1024)} KB data URL)`;
        },
      );

    // Knowledge base file.
    const kb = ctx.kb;
    if (!kb.exists) {
      checks.push({
        id: 'B-kb',
        title: 'Knowledge base file exists',
        status: 'FAIL',
        detail: `${PATHS.vectorStore} is missing: run npm run ingest -w server.`,
        evidence: [PATHS.vectorStore],
      });
    } else {
      const problems: string[] = [];
      if (kb.embedModel !== env.GEMINI_EMBED_MODEL)
        problems.push(
          `index model ${kb.embedModel} ≠ GEMINI_EMBED_MODEL ${env.GEMINI_EMBED_MODEL}`,
        );
      if (kb.dimensions !== env.GEMINI_EMBED_DIMENSIONS)
        problems.push(
          `index dimensions ${kb.dimensions} ≠ GEMINI_EMBED_DIMENSIONS ${env.GEMINI_EMBED_DIMENSIONS}`,
        );
      const unverified = kb.documents.filter((document) => document.sample || !document.verified);
      if (unverified.length)
        problems.push(
          `unverified documents in the index: ${unverified.map((d) => d.schemeId).join(', ')}`,
        );
      checks.push({
        id: 'B-kb',
        title: 'Knowledge base file exists and matches the embedding settings',
        status: problems.length ? 'FAIL' : 'PASS',
        detail: `${kb.chunks.length} chunks from ${kb.documents.length} documents (${kb.documents.map((d) => d.schemeId).join(', ')}); model ${kb.embedModel}, ${kb.dimensions} dimensions.${problems.length ? ` Problems: ${problems.join('; ')}.` : ''}`,
        evidence: ['server/data/vectorstore.json'],
        data: { chunks: kb.chunks.length, documents: kb.documents.length },
      });
    }

    // Freshness and scheme document status.
    try {
      const documents = await loadSchemeDocuments(PATHS.schemes);
      const current = fingerprintDocuments(verifiedOfficialDocuments(documents));
      // The fingerprint hashes raw text, so a Windows (CRLF) checkout fingerprints differently.
      const crlf = fingerprintDocuments(
        verifiedOfficialDocuments(documents).map((document) => ({
          ...document,
          body: document.body.replace(/\r?\n/g, '\r\n'),
        })),
      );
      const lf = fingerprintDocuments(
        verifiedOfficialDocuments(documents).map((document) => ({
          ...document,
          body: document.body.replace(/\r\n/g, '\n'),
        })),
      );
      const exact = kb.exists && current === kb.sourceFingerprint;
      const lineEndingsOnly =
        kb.exists && !exact && (crlf === kb.sourceFingerprint || lf === kb.sourceFingerprint);
      checks.push({
        id: 'B-kb-fresh',
        title: 'Index was built from the current verified scheme documents',
        status: exact ? 'PASS' : lineEndingsOnly ? 'PARTIAL' : 'FAIL',
        detail: !kb.exists
          ? 'no index to compare'
          : exact
            ? `fingerprint ${current} matches the index.`
            : lineEndingsOnly
              ? `Content matches, line endings do not: this checkout fingerprints as ${current}, the index was built from ${crlf === kb.sourceFingerprint ? 'CRLF (Windows)' : 'LF'} text (${kb.sourceFingerprint}). The server's startup check (server/src/startup.ts) compares raw fingerprints, so it logs a false "data/schemes changed since the last ingest" warning on this platform. Re-ingest on the deploy platform or normalize line endings in fingerprintDocuments.`
              : `fingerprint of data/schemes (verified only) ${current} ≠ index ${kb.sourceFingerprint}: run npm run ingest -w server.`,
        evidence: [
          'data/schemes/*.md',
          'server/data/vectorstore.json',
          'server/src/modules/rag/documents.ts fingerprintDocuments',
        ],
      });
      const notReady = documents.filter((document) => document.sample || !document.verified);
      checks.push({
        id: 'B-docs',
        title: 'Scheme documents marked verified (front matter)',
        status: notReady.length === 0 ? 'PASS' : 'PARTIAL',
        detail: `${documents.length} documents; ${notReady.length} sample/unverified${notReady.length ? `: ${notReady.map((d) => `${d.schemeId} (sample: ${d.sample}, verified: ${d.verified})`).join(', ')}` : ''}. Unverified documents are excluded from the index.`,
        evidence: ['data/schemes/*.md front matter'],
        data: { documents: documents.length, notReady: notReady.map((d) => d.schemeId) },
      });
    } catch (error) {
      checks.push({
        id: 'B-docs',
        title: 'Scheme documents readable',
        status: 'FAIL',
        detail: String(error),
        evidence: ['data/schemes'],
      });
    }
    return { checks };
  });
}

// ---------------------------------------------------------------------------
// Stage C: retrieval
// ---------------------------------------------------------------------------

export function stageC(ctx: WorkerContext): Promise<StageResult> {
  const mode = stageMode(['rag']);
  return runStage('C', 'Retrieval', mode === 'none' ? 'none' : mode, async () => {
    if (mode === 'none') return { checks: [], status: 'NOT-TESTED', reason: NO_KEY_REASON };
    const inKb = new Set(ctx.kb.documents.map((document) => document.schemeId));
    const questions = ctx.gold.questions;
    type Row = { q: GoldQuestion; top1: number; schemes: string[] };
    const rows: Row[] = [];
    for (const q of questions) {
      const hits = await searchSchemes({
        query: q.text,
        language: q.language,
        skipTranslation: true,
      });
      rows.push({ q, top1: hits[0]?.score ?? 0, schemes: hits.map((hit) => hit.schemeId) });
    }
    const nonSchemeTop: { id: string; top1: number }[] = [];
    for (const message of ctx.gold.nonScheme) {
      const hits = await searchSchemes({
        query: message.text,
        language: message.language,
        skipTranslation: true,
      });
      nonSchemeTop.push({ id: message.id, top1: hits[0]?.score ?? 0 });
    }

    const checks: Check[] = [];
    const answerable = rows.filter((row) => inKb.has(row.q.expectedSchemeId));
    for (const language of AUDIT_LANGUAGES) {
      const own = answerable.filter((row) => row.q.language === language);
      const found = own.filter((row) => row.schemes.includes(row.q.expectedSchemeId));
      const recall = own.length ? found.length / own.length : 0;
      const missed = own
        .filter((row) => !row.schemes.includes(row.q.expectedSchemeId))
        .map((row) => row.q.faqId);
      checks.push({
        id: `C-recall-${language}`,
        title: `Recall@${env.RAG_TOP_K} for ${language} questions (raw ${language === 'en' ? 'English' : 'native-script'} text)`,
        status: asMode(recall >= 0.9 ? 'PASS' : recall >= 0.6 ? 'PARTIAL' : 'FAIL', mode),
        detail: `${found.length}/${own.length} questions had their scheme in the top ${env.RAG_TOP_K}${missed.length ? `; missed: ${missed.join(', ')}` : ''}. Thresholds: PASS ≥ 0.9, PARTIAL ≥ 0.6.${mode === 'mock' ? ` ${mockedModulesText(['rag'])}` : ''}`,
        evidence: ['data/faq/questions.json', 'server/eval/audit-goldset.json'],
        data: { recall, found: found.length, total: own.length },
      });
    }

    const english = answerable.filter((row) => row.q.language === 'en').map((row) => row.top1);
    const native = answerable.filter((row) => row.q.language !== 'en').map((row) => row.top1);
    const nonScheme = nonSchemeTop.map((row) => row.top1);
    const outsideKb = rows
      .filter((row) => !inKb.has(row.q.expectedSchemeId))
      .map((row) => row.top1);
    const recommendation =
      english.length && nonScheme.length ? recommendThreshold(english, nonScheme) : undefined;
    const recommendationAll =
      answerable.length && nonScheme.length
        ? recommendThreshold(
            answerable.map((row) => row.top1),
            nonScheme,
          )
        : undefined;
    const passingNonScheme = nonSchemeTop.filter((row) => row.top1 >= env.RAG_MIN_SCORE);
    const blockedScheme = answerable.filter((row) => row.top1 < env.RAG_MIN_SCORE);

    checks.push({
      id: 'C-separation',
      title: 'Scheme and non-scheme scores separate',
      status: asMode(recommendation?.separated ? 'PASS' : 'PARTIAL', mode),
      detail: recommendation
        ? recommendation.separated
          ? `English scheme questions (the form the live pipeline searches with) all score above every non-scheme message: lowest scheme ${recommendation.schemeMin.toFixed(3)} > highest non-scheme ${recommendation.nonSchemeMax.toFixed(3)}.`
          : `Overlap: lowest English scheme score ${recommendation.schemeMin.toFixed(3)} ≤ highest non-scheme score ${recommendation.nonSchemeMax.toFixed(3)}; no single threshold separates them, so some non-scheme messages pass retrieval (the intent router must catch them) or some scheme questions are dropped.`
        : 'not enough scores',
      evidence: ['results.json stages.C.data'],
    });
    checks.push({
      id: 'C-threshold',
      title: `Current RAG_MIN_SCORE (${env.RAG_MIN_SCORE}) on this gold set`,
      status: asMode(
        passingNonScheme.length === 0 && blockedScheme.length === 0 ? 'PASS' : 'PARTIAL',
        mode,
      ),
      detail: `${blockedScheme.length}/${answerable.length} answerable questions score below the threshold${
        blockedScheme.length
          ? ` (${blockedScheme
              .slice(0, 8)
              .map((row) => `${row.q.language}:${row.q.faqId} ${row.top1.toFixed(3)}`)
              .join(', ')}${blockedScheme.length > 8 ? ', …' : ''})`
          : ''
      }; ${passingNonScheme.length}/${nonSchemeTop.length} non-scheme messages pass it${passingNonScheme.length ? ` (${passingNonScheme.map((row) => `${row.id} ${row.top1.toFixed(3)}`).join(', ')})` : ''}. Recommendation from English questions vs non-scheme: ${recommendation ? recommendation.threshold.toFixed(3) : '-'}${recommendation && !recommendation.separated ? ' (best balanced accuracy; groups overlap)' : ''}; from all languages: ${recommendationAll ? recommendationAll.threshold.toFixed(3) : '-'}. The live router searches with an English query, so the English-based value is the relevant one; do not change RAG_MIN_SCORE from mock results.`,
      evidence: [
        'results.json stages.C.data',
        'server/scripts/calibrate-rag.ts recommendThreshold',
      ],
    });
    return {
      checks,
      data: {
        topK: env.RAG_TOP_K,
        minScore: env.RAG_MIN_SCORE,
        englishScheme: distribution(english),
        nativeScheme: distribution(native),
        nonScheme: distribution(nonScheme),
        outsideKnowledgeBase: distribution(outsideKb),
        recommendation,
        recommendationAllLanguages: recommendationAll,
        summary: {
          englishScheme: formatDistribution(distribution(english)),
          nativeScheme: formatDistribution(distribution(native)),
          nonScheme: formatDistribution(distribution(nonScheme)),
          outsideKnowledgeBase: formatDistribution(distribution(outsideKb)),
        },
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Stage D: text answers
// ---------------------------------------------------------------------------

interface AnswerReview {
  problems: string[];
  notes: string[];
  facts: Facts;
  unsupported: Facts;
}

/** Contract and grounding checks for one scheme answer. */
export function reviewSchemeAnswer(
  result: ApiResult<QueryResponse>,
  expectedLanguage: LanguageCode,
  expectedSchemeId: string,
  ctx: WorkerContext,
): AnswerReview {
  const problems: string[] = [];
  const notes: string[] = [];
  const empty: Facts = { numbers: [], rupees: [], urls: [], phones: [] };
  if (result.status !== 200 || !result.body || isErrorBody(result.body)) {
    problems.push(`HTTP ${result.status}${errorCode(result) ? ` ${errorCode(result)}` : ''}`);
    return { problems, notes, facts: empty, unsupported: empty };
  }
  const response = result.body;
  if (response.detectedLanguage !== expectedLanguage)
    problems.push(`detectedLanguage ${response.detectedLanguage} ≠ ${expectedLanguage}`);
  problems.push(...scriptProblems(response.answer, expectedLanguage, schemeNames(ctx)));
  if (response.notFound) problems.push('notFound for an answerable question');
  if (response.sources.length === 0) problems.push('no sources');
  const invalid = response.sources.filter((source) => !sourceMatchesKb(source, ctx.kb));
  if (invalid.length)
    problems.push(
      `sources not found in the index: ${invalid.map((s) => `${s.schemeId}/${s.section}`).join(', ')}`,
    );
  if (
    !response.notFound &&
    !response.sources.some((source) => source.schemeId === expectedSchemeId)
  ) {
    problems.push(`expected scheme ${expectedSchemeId} not cited`);
  }
  const facts = extractFacts(response.answer);
  const unsupported = missingFacts(facts, supportedFacts(response.sources, ctx.kb));
  if (hasFacts(unsupported))
    problems.push(`facts not in the cited passages: ${describeFacts(unsupported)}`);
  notes.push(
    `intent ${response.intent ?? '(none)'}; ${response.sources.length} source(s); facts ${describeFacts(facts)}`,
  );
  return { problems, notes, facts, unsupported };
}

export function scriptProblems(text: string, language: LanguageCode, allowed: string[]): string[] {
  const counts = scriptCounts(text);
  const expected = expectedScript(language);
  const problems: string[] = [];
  if (expected === 'devanagari' && counts.devanagari === 0) problems.push('no Devanagari text');
  if (expected === 'tamil' && counts.tamil === 0) problems.push('no Tamil text');
  if (expected === 'latin' && (counts.devanagari > 0 || counts.tamil > 0))
    problems.push('Indic script in an English reply');
  if (expected !== 'latin') {
    const roman = romanWords(text, allowed);
    if (roman.length)
      problems.push(`Roman-script words: ${[...new Set(roman)].slice(0, 8).join(' ')}`);
  }
  return problems;
}

function answerExcerpt(result: ApiResult<QueryResponse>): string {
  if (!result.body || isErrorBody(result.body))
    return `HTTP ${result.status} ${errorCode(result) ?? ''}`.trim();
  const body = result.body;
  return `answer: “${excerpt(body.answer, 180)}” (notFound ${body.notFound}, intent ${body.intent ?? '-'}, sources ${body.sources.map((s) => s.schemeId).join('|') || 'none'})`;
}

export function stageD(ctx: WorkerContext, only: 'all' | 'clarify' = 'all'): Promise<StageResult> {
  const mode = stageMode(['chat', 'rag']);
  return runStage(
    'D',
    'Text answers (POST /api/chat/query)',
    mode === 'none' ? 'none' : mode,
    async () => {
      if (mode === 'none') return { checks: [], status: 'NOT-TESTED', reason: NO_KEY_REASON };
      const checks: Check[] = [];
      const inKb = new Set(ctx.kb.documents.map((document) => document.schemeId));
      const mockNote = mode === 'mock' ? ` ${mockedModulesText(['chat', 'rag'])}` : '';

      if (only === 'all') {
        const perLanguage = textCasesPerLanguage();
        const picked = TEXT_PRIORITY.filter((id) =>
          inKb.has(ctx.gold.questions.find((q) => q.faqId === id)?.expectedSchemeId ?? ''),
        ).slice(0, perLanguage);
        for (const language of AUDIT_LANGUAGES) {
          const statuses: Status[] = [];
          for (const faqId of picked) {
            const q = ctx.gold.questions.find(
              (item) => item.faqId === faqId && item.language === language,
            );
            if (!q) continue;
            const result = await ctx.transport.chat({
              text: q.text,
              language,
              sessionId: sessionId('d'),
            });
            ctx.latencies.text.push(result.ms);
            const review = reviewSchemeAnswer(result, language, q.expectedSchemeId, ctx);
            const status = asMode(review.problems.length ? 'FAIL' : 'PASS', mode);
            statuses.push(review.problems.length ? 'FAIL' : 'PASS');
            checks.push({
              id: `D-${language}-${faqId}`,
              title: `${language}: ${q.text}`,
              status,
              detail: `${review.problems.length ? `Problems: ${review.problems.join('; ')}.` : 'All contract, script, source and fact checks passed.'} ${review.notes.join(' ')}.${mockNote}`,
              evidence: [answerExcerpt(result)],
            });
          }
          ctx.regional.push({
            row: language,
            column: 'answersInLanguage',
            status: asMode(
              statuses.length === 0
                ? 'NOT-TESTED'
                : statuses.every((s) => s === 'PASS')
                  ? 'PASS'
                  : statuses.some((s) => s === 'PASS')
                    ? 'PARTIAL'
                    : 'FAIL',
              mode,
            ),
            evidence: `results.json stages.D checks D-${language}-*`,
          });
        }

        // A question about a scheme that is not in the index must not be answered from memory.
        const outside = ctx.gold.questions.find(
          (q) => q.language === 'hi' && !inKb.has(q.expectedSchemeId),
        );
        if (outside) {
          const result = await ctx.transport.chat({
            text: outside.text,
            language: 'hi',
            sessionId: sessionId('d-out'),
          });
          const body = result.body && !isErrorBody(result.body) ? result.body : undefined;
          const ok = Boolean(body?.notFound) && (body?.sources.length ?? 0) === 0;
          checks.push({
            id: 'D-outside-kb',
            title: `Scheme not in the index (${outside.expectedSchemeId}) is not answered from memory`,
            status: asMode(ok ? 'PASS' : 'FAIL', mode),
            detail: `${ok ? 'notFound with no sources, as required.' : 'Expected notFound with no sources.'}${mockNote}`,
            evidence: [answerExcerpt(result)],
          });
        }

        for (const message of ctx.gold.nonScheme) {
          if (ctx.gold.clarifyMessages.includes(message.text)) continue;
          const result = await ctx.transport.chat({
            text: message.text,
            language: message.language,
            sessionId: sessionId('d-ns'),
          });
          const body = result.body && !isErrorBody(result.body) ? result.body : undefined;
          const schemeAnswer = Boolean(body && body.sources.length > 0);
          checks.push({
            id: `D-nonscheme-${message.id}`,
            title: `Non-scheme message “${message.text}” gets no scheme answer`,
            status: asMode(result.status === 200 && !schemeAnswer ? 'PASS' : 'FAIL', mode),
            detail: `${schemeAnswer ? 'Returned a sourced scheme answer.' : 'No sources returned.'} Expected intent ${message.expectedIntent}; got ${body?.intent ?? '(none)'}.${mockNote}`,
            evidence: [answerExcerpt(result)],
          });
        }
      }

      // The owner's report: "ki keh raho he" got a canned PM-KISAN answer.
      for (const text of ctx.gold.clarifyMessages) {
        const fresh = await ctx.transport.chat({
          text,
          language: 'hi',
          sessionId: sessionId('d-clarify'),
        });
        const body = fresh.body && !isErrorBody(fresh.body) ? fresh.body : undefined;
        const wrongScheme = Boolean(
          body &&
          (body.sources.length > 0 || (!body.notFound && body.intent === 'scheme_question')),
        );
        const facts = body ? extractFacts(body.answer) : undefined;
        checks.push({
          id: `D-clarify-fresh-${text.replace(/\s+/g, '-')}`,
          title: `“${text}” as the first message of a session`,
          status: asMode(
            fresh.status === 200 && !wrongScheme && !(facts && facts.rupees.length)
              ? 'PASS'
              : 'FAIL',
            mode,
          ),
          detail: `${wrongScheme ? 'WRONG: returned a scheme answer.' : 'Did not return a scheme answer.'} Observed mode: ${mode}.${mockNote}`,
          evidence: [answerExcerpt(fresh)],
          data: { mode, wrongScheme, notFound: body?.notFound, intent: body?.intent },
        });

        // After a scheme answer, a clarification should restate it without new facts.
        const followUp = ctx.gold.questions.find(
          (q) => q.faqId === ctx.gold.followUpFaqId && q.language === 'hi',
        );
        if (followUp) {
          const session = sessionId('d-follow');
          const first = await ctx.transport.chat({
            text: followUp.text,
            language: 'hi',
            sessionId: session,
          });
          const second = await ctx.transport.chat({ text, language: 'hi', sessionId: session });
          const firstBody = first.body && !isErrorBody(first.body) ? first.body : undefined;
          const secondBody = second.body && !isErrorBody(second.body) ? second.body : undefined;
          const newFacts =
            firstBody && secondBody
              ? missingFacts(extractFacts(secondBody.answer), extractFacts(firstBody.answer))
              : undefined;
          const problems: string[] = [];
          if (!secondBody) problems.push(`HTTP ${second.status}`);
          else {
            if (secondBody.sources.length > 0)
              problems.push('cited sources again (treated as a new scheme question)');
            if (newFacts && hasFacts(newFacts))
              problems.push(`new facts not in the previous answer: ${describeFacts(newFacts)}`);
            problems.push(...scriptProblems(secondBody.answer, 'hi', schemeNames(ctx)));
          }
          checks.push({
            id: `D-clarify-followup-${text.replace(/\s+/g, '-')}`,
            title: `“${text}” after a PM-KISAN answer`,
            status: asMode(problems.length ? 'FAIL' : 'PASS', mode),
            detail: `${problems.length ? `Problems: ${problems.join('; ')}.` : 'Restated without new facts or sources.'} Intent ${secondBody?.intent ?? '(none)'}.${mockNote}`,
            evidence: [`first: ${answerExcerpt(first)}`, `then: ${answerExcerpt(second)}`],
          });
        }
      }
      return { checks };
    },
  );
}

// ---------------------------------------------------------------------------
// Stage E: dialect text
// ---------------------------------------------------------------------------

export function stageE(ctx: WorkerContext): Promise<StageResult> {
  const mode = stageMode(['chat', 'rag']);
  return runStage('E', 'Dialect text', mode === 'none' ? 'none' : mode, async () => {
    const registry = getDialectRegistry();
    const question = ctx.gold.questions.find(
      (q) => q.faqId === ctx.gold.dialectQuestionFaqId && q.language === 'hi',
    );
    if (!question) throw new Error('dialect question missing from the gold set');
    const csvRows: string[][] = [
      [
        'dialect_id',
        'dialect_name',
        'question',
        'standard_answer',
        'dialect_answer',
        'rendered',
        'render_reason',
        'understandable_1to5',
        'natural_1to5',
        'correct_dialect_1to5',
        'facts_correct_1to5',
        'reviewer',
        'notes',
      ],
    ];
    const writeCsv = () => {
      const directory = path.join(ctx.repoRoot, 'eval/review');
      mkdirSync(directory, { recursive: true });
      writeFileSync(path.join(directory, 'dialect-review.csv'), toCsv(csvRows), 'utf8');
    };

    if (mode === 'none') {
      for (const entry of registry) {
        csvRows.push([
          entry.id,
          entry.name,
          question.text,
          '(not generated: no GEMINI_API_KEY)',
          '(not generated)',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ]);
        ctx.regional.push({
          row: entry.id,
          column: 'answersInDialect',
          status: 'NOT-TESTED',
          evidence: NO_KEY_REASON,
        });
        ctx.regional.push({
          row: entry.id,
          column: 'answersInLanguage',
          status: 'NOT-TESTED',
          evidence: NO_KEY_REASON,
        });
      }
      writeCsv();
      return { checks: [], status: 'NOT-TESTED', reason: NO_KEY_REASON };
    }

    const mockNote = mode === 'mock' ? ` ${mockedModulesText(['chat', 'rag'])}` : '';
    const standard = await ctx.transport.chat({
      text: question.text,
      language: 'hi',
      sessionId: sessionId('e-std'),
    });
    const standardBody = standard.body && !isErrorBody(standard.body) ? standard.body : undefined;
    ctx.shared.standardAnswerHi = standardBody?.answer;
    const standardFacts = standardBody ? extractFacts(standardBody.answer) : undefined;
    const checks: Check[] = [];

    for (const entry of registry) {
      const before = ctx.calls.length;
      const result = await ctx.transport.chat({
        text: question.text,
        language: 'hi',
        dialectHint: entry.id,
        sessionId: sessionId(`e-${entry.id}`),
      });
      const calls = ctx.calls.slice(before);
      const body = result.body && !isErrorBody(result.body) ? result.body : undefined;
      // Prompts other than the understand step's (which lists example dialect names).
      const dialectPrompts = calls.filter(
        (call) =>
          call.kind === 'generate' &&
          !call.system?.startsWith('You are the front door') &&
          (call.system?.includes(entry.id) ||
            call.system?.includes(entry.name) ||
            call.system?.includes(entry.nativeName)),
      );
      const reached = dialectPrompts.length > 0;
      const style = (
        body as
          | (QueryResponse & { answerStyle?: { rendered?: string; reason?: string } })
          | undefined
      )?.answerStyle;
      const problems: string[] = [];
      if (!body) problems.push(`HTTP ${result.status} ${errorCode(result) ?? ''}`.trim());
      else {
        problems.push(...scriptProblems(body.answer, 'hi', schemeNames(ctx)));
        if (body.dialect?.id !== entry.id)
          problems.push(`response dialect ${body.dialect?.id ?? 'null'} ≠ hint ${entry.id}`);
        if (standardFacts) {
          const dialectFacts = extractFacts(body.answer);
          const changed = {
            lost: missingFacts(standardFacts, dialectFacts),
            added: missingFacts(dialectFacts, standardFacts),
          };
          if (hasFacts(changed.lost) || hasFacts(changed.added)) {
            problems.push(
              `facts differ from the standard answer (lost ${describeFacts(changed.lost)}; added ${describeFacts(changed.added)})`,
            );
          }
        }
        const unsupported = missingFacts(
          extractFacts(body.answer),
          supportedFacts(body.sources, ctx.kb),
        );
        if (hasFacts(unsupported))
          problems.push(`facts not in the cited passages: ${describeFacts(unsupported)}`);
      }
      const rendered =
        style?.rendered ??
        (reached ? 'unknown (no answerStyle field; dialect instruction reached a prompt)' : 'no');
      if (body) ctx.shared.dialectAnswers.set(entry.id, body.answer);
      csvRows.push([
        entry.id,
        entry.name,
        question.text,
        standardBody?.answer ?? '',
        body?.answer ?? `(error ${result.status})`,
        String(style?.rendered ?? (reached ? 'unknown' : 'standard')),
        style?.reason ?? '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
      const technical: Status = problems.length ? 'FAIL' : 'PASS';
      checks.push({
        id: `E-${entry.id}`,
        title: `${entry.name} (${entry.nativeName}) with dialectHint`,
        status: asMode(problems.length ? 'FAIL' : 'NEEDS-HUMAN', mode),
        detail: `Dialect instruction reached a generation prompt: ${reached ? `yes (${dialectPrompts.map((call) => call.label).join(', ')})` : 'no'}. Rendered: ${rendered}${style?.reason ? ` (${style.reason})` : ''}. ${problems.length ? `Problems: ${problems.join('; ')}.` : 'Script and facts checks passed; whether it sounds like the dialect is for a native speaker (eval/review/dialect-review.csv).'}${mockNote}`,
        evidence: [answerExcerpt(result)],
        data: { reached, rendered: style?.rendered, reason: style?.reason, technical },
      });
      const dialectCell: Status = problems.length
        ? 'FAIL'
        : style?.rendered === 'standard'
          ? 'FAIL'
          : 'NEEDS-HUMAN';
      ctx.regional.push({
        row: entry.id,
        column: 'answersInDialect',
        status: asMode(dialectCell, mode),
        evidence: `results.json stages.E check E-${entry.id}${style?.rendered === 'standard' ? ` (rendered standard: ${style.reason ?? 'no reason'})` : ''}`,
      });
      ctx.regional.push({
        row: entry.id,
        column: 'answersInLanguage',
        status: asMode(
          body &&
            scriptProblems(body.answer, 'hi', schemeNames(ctx)).length === 0 &&
            body.detectedLanguage === 'hi'
            ? 'PASS'
            : 'FAIL',
          mode,
        ),
        evidence: `results.json stages.E check E-${entry.id}`,
      });
    }
    writeCsv();
    return {
      checks,
      data: {
        question: question.text,
        standardAnswer: standardBody ? excerpt(standardBody.answer, 300) : undefined,
        reviewFile: 'eval/review/dialect-review.csv',
      },
    };
  });
}

/** Modules whose mock state matters for a stage, for the report. */
export function mockedStageModules(): string[] {
  return (['chat', 'rag', 'voice', 'dialect', 'tts'] as const).filter((module) => isMocked(module));
}
