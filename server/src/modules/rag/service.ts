import type { LanguageCode, RetrievedChunk } from '@gram-saathi/shared';
import { env, isMocked, PATHS } from '../../config/env';
import { embedTexts, generateJson } from '../../lib/geminiClient';
import { HttpError } from '../../lib/httpError';
import { logger } from '../../lib/logger';
import { mockSearchSchemes } from '../../mocks';
import { isOfficialSourceUrl, slugify } from './documents';
import { TRANSLATE_QUERY_PROMPT, translateQuerySchema } from './prompts';
import { VectorStore, type ScoredChunk } from './vectorStore';

export interface SearchInput {
  /** The user's question, in any supported language. */
  query: string;
  /** Language of the question, if known. */
  language?: LanguageCode;
  /** Defaults to RAG_TOP_K. */
  topK?: number;
}

let knowledgeBase: VectorStore | undefined;

/** Loads server/data/vectorstore.json (built by `npm run ingest`) into memory. */
export function loadKnowledgeBase(filePath: string = PATHS.vectorStore): VectorStore | undefined {
  knowledgeBase = VectorStore.fromFile(filePath);
  return knowledgeBase;
}

/** The loaded store; loads it on first use (serverless instances may skip startup). */
export function getKnowledgeBase(): VectorStore | undefined {
  return knowledgeBase ?? loadKnowledgeBase();
}

/** For tests and scripts. */
export function setKnowledgeBase(store: VectorStore | undefined): void {
  knowledgeBase = store;
}

/** The chunks most similar to the question, best first (unfiltered: callers apply RAG_MIN_SCORE). */
export async function searchSchemes(input: SearchInput): Promise<ScoredChunk[]> {
  const topK = input.topK ?? env.RAG_TOP_K;
  if (isMocked('rag')) return mockSearchSchemes(input.query, topK).map(fromMockChunk);

  const store = getKnowledgeBase();
  if (!store) {
    throw new HttpError(
      503,
      'KNOWLEDGE_BASE_MISSING',
      'No knowledge base: run `npm run ingest -w server` (server/data/vectorstore.json).',
    );
  }
  const unverified = store.meta.documents.filter(
    (document) =>
      document.sample || !document.verified || !isOfficialSourceUrl(document.officialUrl),
  );
  if (unverified.length > 0) {
    throw new HttpError(
      503,
      'KNOWLEDGE_BASE_UNVERIFIED',
      'The knowledge base includes documents that are not verified official sources. ' +
        'Rebuild it with `npm run ingest -w server` after verifying the source files.',
    );
  }
  const query =
    env.RAG_TRANSLATE_QUERY && input.language !== 'en'
      ? await translateQueryToEnglish(input.query)
      : input.query;
  // Query vectors must come from the same model and size as the stored document vectors.
  const [vector] = await embedTexts([query], {
    kind: 'query',
    model: store.meta.embedModel,
    dimensions: store.meta.dimensions,
  });
  return store.search(vector, topK);
}

/** Contract shape for the debug endpoint. */
export function toRetrievedChunk(chunk: ScoredChunk): RetrievedChunk {
  return {
    schemeId: chunk.schemeId,
    schemeName: chunk.schemeName,
    section: chunk.section,
    text: chunk.text,
    score: Math.round(chunk.score * 10_000) / 10_000,
  };
}

/** Optional (RAG_TRANSLATE_QUERY): English queries can match English documents better. */
async function translateQueryToEnglish(query: string): Promise<string> {
  try {
    const { english } = await generateJson({
      label: 'translate-query',
      system: TRANSLATE_QUERY_PROMPT,
      input: query,
      schema: translateQuerySchema,
      maxOutputTokens: 512,
    });
    return english.trim() || query;
  } catch (error) {
    logger.warn(`Query translation failed, searching with the original text: ${String(error)}`);
    return query;
  }
}

function fromMockChunk(chunk: RetrievedChunk): ScoredChunk {
  return { ...chunk, chunkId: `${chunk.schemeId}:${slugify(chunk.section)}:0`, sourceFile: 'mock' };
}
