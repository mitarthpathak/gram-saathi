import type { LanguageCode, RetrievedChunk } from '@gram-saathi/shared';
import { isMocked } from '../../config/env';
import { NotImplementedError } from '../../lib/httpError';
import { mockSearchSchemes } from '../../mocks';

export interface SearchInput {
  /** The user's question, in any supported language. */
  query: string;
  language?: LanguageCode;
  /** Defaults to 4. */
  topK?: number;
}

/**
 * Finds the scheme-document chunks most relevant to a question, best first.
 * Source documents live in data/schemes/*.md (format: data/schemes/README.md).
 */
export async function searchSchemes(input: SearchInput): Promise<RetrievedChunk[]> {
  const topK = input.topK ?? 4;
  if (isMocked('rag')) return mockSearchSchemes(input.query, topK);

  // TODO(step-2): load data/schemes/*.md once at startup, split each file into chunks by `##`
  //   heading (keep schemeId/schemeName/section on every chunk) and rank them: keyword/BM25,
  //   or cosine similarity over lib/geminiClient.embedTexts() kept in memory. Questions arrive
  //   in hi/mr/ta/en while the documents are English, so use multilingual embeddings or
  //   translate the query first. Drop chunks under a relevance threshold so chat can answer
  //   "notFound" instead of guessing.
  // TODO(step-3): move the embeddings into a vector DB and query it here.
  throw new NotImplementedError('rag.searchSchemes');
}
