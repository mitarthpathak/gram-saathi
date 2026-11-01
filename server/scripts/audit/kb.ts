/** Read-only view of the knowledge base file for source and fact checks. */
import { existsSync, readFileSync } from 'node:fs';
import type { Source } from '@gram-saathi/shared';
import { PATHS } from '../../src/config/env';
import { englishNumberWords, extractFacts, mergeFacts, type Facts } from '../../src/lib/facts';
import { toPlainText } from '../../src/modules/chat/service';

export interface KbChunk {
  chunkId: string;
  schemeId: string;
  schemeName: string;
  section: string;
  text: string;
}

export interface KbDocument {
  schemeId: string;
  schemeName: string;
  sample: boolean;
  verified: boolean;
}

export interface KnowledgeBaseView {
  exists: boolean;
  embedModel?: string;
  dimensions?: number;
  sourceFingerprint?: string;
  documents: KbDocument[];
  chunks: KbChunk[];
}

export function readKnowledgeBase(filePath: string = PATHS.vectorStore): KnowledgeBaseView {
  if (!existsSync(filePath)) return { exists: false, documents: [], chunks: [] };
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as {
    embedModel?: string;
    dimensions?: number;
    sourceFingerprint?: string;
    documents?: KbDocument[];
    chunks?: KbChunk[];
  };
  return {
    exists: true,
    embedModel: raw.embedModel,
    dimensions: raw.dimensions,
    sourceFingerprint: raw.sourceFingerprint,
    documents: raw.documents ?? [],
    chunks: (raw.chunks ?? []).map(({ chunkId, schemeId, schemeName, section, text }) => ({
      chunkId,
      schemeId,
      schemeName,
      section,
      text,
    })),
  };
}

const flat = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Whether a cited source matches a real chunk (scheme, section and verbatim snippet). */
export function sourceMatchesKb(source: Source, kb: KnowledgeBaseView): boolean {
  const snippet = flat(source.snippet.replace(/…$/, ''));
  return kb.chunks.some(
    (chunk) =>
      chunk.schemeId === source.schemeId &&
      chunk.section === source.section &&
      flat(toPlainText(chunk.text)).includes(snippet),
  );
}

/**
 * Facts supported by the cited sources: the full text of every KB chunk with the same scheme
 * and section (snippets are cut at ~300 characters), or the snippet itself when no chunk matches.
 * English number words ("three") count as their digits.
 */
export function supportedFacts(sources: Source[], kb: KnowledgeBaseView): Facts {
  const texts = sources.flatMap((source) => {
    const chunks = kb.chunks.filter(
      (chunk) => chunk.schemeId === source.schemeId && chunk.section === source.section,
    );
    return chunks.length > 0 ? chunks.map((chunk) => chunk.text) : [source.snippet];
  });
  return mergeFacts(
    ...texts.map((text) => {
      const facts = extractFacts(text);
      return { ...facts, numbers: [...facts.numbers, ...englishNumberWords(text)] };
    }),
  );
}
