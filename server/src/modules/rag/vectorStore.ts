import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { cosineSimilarity, decodeVector, encodeVector } from '../../lib/vectors';
import type { DocumentChunk } from './chunking';

/** A chunk with its similarity to the query (cosine, -1..1; higher is closer). */
export interface ScoredChunk extends Omit<DocumentChunk, 'tokens'> {
  score: number;
}

const chunkSchema = z.object({
  chunkId: z.string(),
  schemeId: z.string(),
  schemeName: z.string(),
  section: z.string(),
  sourceFile: z.string(),
  text: z.string(),
  tokens: z.number(),
  /** Float32 vector, base64 (see lib/vectors.ts). */
  embedding: z.string(),
});

/** Shape of server/data/vectorstore.json (written by `npm run ingest`). */
export const vectorStoreFileSchema = z.object({
  version: z.literal(1),
  createdAt: z.string(),
  embedModel: z.string(),
  dimensions: z.number().int().positive(),
  /** fingerprintDocuments() of data/schemes at ingestion time. */
  sourceFingerprint: z.string(),
  chunking: z.object({
    targetTokens: z.number(),
    maxTokens: z.number(),
    overlapTokens: z.number(),
  }),
  documents: z.array(
    z.object({
      schemeId: z.string(),
      schemeName: z.string(),
      sourceFile: z.string(),
      sample: z.boolean(),
    }),
  ),
  chunks: z.array(chunkSchema),
});

export type VectorStoreFile = z.infer<typeof vectorStoreFileSchema>;

interface StoredChunk extends DocumentChunk {
  vector: Float32Array;
}

/** In-memory vector index. Brute-force cosine similarity is instant for a few thousand chunks. */
export class VectorStore {
  readonly meta: Omit<VectorStoreFile, 'chunks'>;
  private readonly chunks: StoredChunk[];

  constructor(file: VectorStoreFile) {
    const { chunks, ...meta } = file;
    this.meta = meta;
    this.chunks = chunks.map(({ embedding, ...chunk }) => {
      const vector = decodeVector(embedding);
      if (vector.length !== file.dimensions) {
        throw new Error(
          `Chunk ${chunk.chunkId} has ${vector.length} dimensions, expected ${file.dimensions}`,
        );
      }
      return { ...chunk, vector };
    });
  }

  get size(): number {
    return this.chunks.length;
  }

  /** The `topK` chunks most similar to `query`, best first. */
  search(query: Float32Array, topK: number): ScoredChunk[] {
    return this.chunks
      .map(({ vector, tokens: _tokens, ...chunk }) => ({
        ...chunk,
        score: cosineSimilarity(query, vector),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /** Reads and validates a store file; undefined when the file does not exist. */
  static fromFile(filePath: string): VectorStore | undefined {
    if (!existsSync(filePath)) return undefined;
    const json: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    return new VectorStore(vectorStoreFileSchema.parse(json));
  }
}

/** Assembles the file contents from chunks and their embeddings (same order). */
export function buildVectorStoreFile(
  meta: Omit<VectorStoreFile, 'chunks'>,
  chunks: DocumentChunk[],
  vectors: Float32Array[],
): VectorStoreFile {
  if (chunks.length !== vectors.length) {
    throw new Error(`Got ${vectors.length} vectors for ${chunks.length} chunks`);
  }
  return {
    ...meta,
    chunks: chunks.map((chunk, i) => ({ ...chunk, embedding: encodeVector(vectors[i]) })),
  };
}

/** Writes the store as indented JSON (stable for Prettier, readable in diffs). */
export async function writeVectorStore(filePath: string, file: VectorStoreFile): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
}
