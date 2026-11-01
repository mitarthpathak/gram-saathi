import path from 'node:path';
import { env, isMocked, MOCKABLE_MODULES, PATHS } from './config/env';
import { isGeminiConfigured } from './lib/geminiClient';
import { logger } from './lib/logger';
import { loadRules } from './modules/eligibility/service';
import { loadFaq } from './modules/faq/service';
import {
  fingerprintDocuments,
  isOfficialSourceUrl,
  loadSchemeDocuments,
  verifiedOfficialDocuments,
} from './modules/rag/documents';
import { loadKnowledgeBase } from './modules/rag/service';
import { getDialectSettings } from './modules/dialect/calibration';
import { logDialectExemplarCoverage } from './modules/dialect/exemplars';

const relative = (file: string) => path.relative(process.cwd(), file) || file;

/**
 * Loads the data files up front and says what is missing or stale. Missing data is only a
 * warning (the endpoint then answers 503 with the command to run); a broken eligibility rule
 * file throws, so a bad edit cannot reach users.
 */
export async function initServices({ checkSources = true } = {}): Promise<void> {
  const dialectSettings = getDialectSettings();
  logger.info(
    `Dialect classifier: ensemble=${dialectSettings.ensembleSize}, minVotes=${dialectSettings.minimumVotes}, ` +
      `Gemini concurrency=${env.GEMINI_MAX_CONCURRENT_CALLS} (one slot reserved for answers)`,
  );
  logDialectExemplarCoverage();
  const usesGemini = MOCKABLE_MODULES.filter((m) => !isMocked(m) && m !== 'faq' && m !== 'tts');
  if (usesGemini.length > 0 && !isGeminiConfigured()) {
    logger.warn(
      `GEMINI_API_KEY is not set: ${usesGemini.join(', ')} cannot call Gemini (503 AI_NOT_CONFIGURED). ` +
        'Add it to .env, or run with USE_MOCKS=true.',
    );
  }

  const sourceFingerprint = isMocked('rag') ? undefined : await checkKnowledgeBase(checkSources);
  if (!isMocked('faq')) checkFaq(sourceFingerprint);
  if (!isMocked('eligibility')) checkEligibilityRules();
}

/** `checkSources`: compare with data/schemes (not deployed on serverless hosts). */
async function checkKnowledgeBase(checkSources: boolean): Promise<string | undefined> {
  const store = loadKnowledgeBase();
  if (!store) {
    logger.warn(
      `No knowledge base at ${relative(PATHS.vectorStore)}: run \`npm run ingest -w server\`. ` +
        'Questions answer 503 KNOWLEDGE_BASE_MISSING until then.',
    );
    return undefined;
  }
  const { meta } = store;
  logger.info(
    `Knowledge base: ${store.size} chunks from ${meta.documents.length} documents ` +
      `(${meta.embedModel}, ${meta.dimensions} dims, built ${meta.createdAt})`,
  );
  const unverified = meta.documents.filter(
    (document) =>
      document.sample || !document.verified || !isOfficialSourceUrl(document.officialUrl),
  );
  if (unverified.length > 0) {
    logger.warn(
      `${unverified.length} unverified scheme document(s) in the knowledge base ` +
        `(${unverified.map((document) => document.schemeId).join(', ')}): ` +
        'requests are blocked until the index is rebuilt from verified official sources.',
    );
  }
  if (
    meta.embedModel !== env.GEMINI_EMBED_MODEL ||
    meta.dimensions !== env.GEMINI_EMBED_DIMENSIONS
  ) {
    logger.warn(
      `The knowledge base uses ${meta.embedModel} (${meta.dimensions} dims) and queries follow it; ` +
        'run `npm run ingest -w server` to switch to GEMINI_EMBED_MODEL / GEMINI_EMBED_DIMENSIONS.',
    );
  }
  if (!checkSources) return meta.sourceFingerprint;
  try {
    const current = fingerprintDocuments(
      verifiedOfficialDocuments(await loadSchemeDocuments(PATHS.schemes)),
    );
    if (current !== meta.sourceFingerprint) {
      logger.warn('data/schemes changed since the last ingest: run `npm run ingest -w server`.');
    }
  } catch (error) {
    logger.warn(`Could not compare data/schemes with the knowledge base: ${String(error)}`);
  }
  return meta.sourceFingerprint;
}

function checkFaq(sourceFingerprint: string | undefined): void {
  try {
    const faq = loadFaq();
    if (!faq) {
      logger.warn(
        `No FAQ answers at ${relative(PATHS.faq)}: run \`npm run prewarm -w server\`. ` +
          'GET /api/faq/top answers 503 FAQ_NOT_READY until then.',
      );
      return;
    }
    const counts = Object.entries(faq.languages).map(
      ([language, items]) => `${items.length} ${language}`,
    );
    logger.info(
      `FAQ answers: ${counts.join(', ')} (from ${faq.createdAt}), also in the answer cache`,
    );
    if (sourceFingerprint && faq.sourceFingerprint !== sourceFingerprint) {
      logger.warn(
        'The FAQ answers come from an older knowledge base: run `npm run prewarm -w server`.',
      );
    }
  } catch (error) {
    logger.warn(`Ignoring ${relative(PATHS.faq)}: ${String(error)}`);
  }
}

function checkEligibilityRules(): void {
  const rules = loadRules();
  logger.info(`Eligibility: ${rules.schemes.length} schemes, ${rules.questions.length} questions`);
  const unverified = rules.schemes.filter((scheme) => !scheme.verified);
  if (unverified.length > 0) {
    logger.warn(
      `Eligibility rules NOT VERIFIED against official sources: ` +
        `${unverified.map((scheme) => scheme.schemeId).join(', ')} (see data/eligibility/README.md)`,
    );
  }
}
