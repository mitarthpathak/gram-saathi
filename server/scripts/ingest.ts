/**
 * Builds the knowledge base: data/schemes/* -> chunks -> embeddings -> server/data/vectorstore.json
 *
 *   npm run ingest -w server                      embed and write the store (needs GEMINI_API_KEY)
 *   npm run ingest -w server -- --dry-run         only load + chunk the documents and print stats
 *   npm run ingest -w server -- --batch-size 20   smaller embedding batches
 *
 * Restart the server afterwards to load the new store.
 */
import path from 'node:path';
import { env, PATHS } from '../src/config/env';
import { embedTexts, isGeminiConfigured } from '../src/lib/geminiClient';
import { chunkDocument, DEFAULT_CHUNKING } from '../src/modules/rag/chunking';
import {
  fingerprintDocuments,
  loadSchemeDocuments,
  verifiedOfficialDocuments,
} from '../src/modules/rag/documents';
import { buildVectorStoreFile, writeVectorStore } from '../src/modules/rag/vectorStore';

const relative = (file: string) => path.relative(process.cwd(), file) || file;

function numberFlag(args: string[], name: string, fallback: number): number {
  const index = args.indexOf(name);
  const value = index >= 0 ? Number(args[index + 1]) : fallback;
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} needs a positive integer`);
  return value;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const batchSize = numberFlag(args, '--batch-size', 50);

  const discovered = await loadSchemeDocuments(PATHS.schemes);
  const documents = verifiedOfficialDocuments(discovered);
  const skipped = discovered.filter((document) => !documents.includes(document));
  if (discovered.length === 0) {
    throw new Error(`No .md, .txt or .pdf files found in ${relative(PATHS.schemes)}`);
  }
  if (skipped.length > 0) {
    console.warn(
      `\n! Skipping ${skipped.length} document(s) without verified, secure official sources: ` +
        skipped.map((document) => document.sourceFile).join(', '),
    );
  }
  if (documents.length === 0) {
    throw new Error(
      'No verified official documents are ready to index. Check each document has ' +
        'sample: false, verified: true and an HTTPS .gov.in/.nic.in source (or PFRDA).',
    );
  }
  const chunks = documents.flatMap((document) => chunkDocument(document, DEFAULT_CHUNKING));

  console.log(
    `${documents.length} documents -> ${chunks.length} chunks (${relative(PATHS.schemes)})`,
  );
  for (const document of documents) {
    const own = chunks.filter((chunk) => chunk.schemeId === document.schemeId);
    const status = document.sample ? 'SAMPLE' : document.verified ? 'verified' : 'not verified';
    const largest = Math.max(...own.map((chunk) => chunk.tokens));
    console.log(
      `  ${document.sourceFile.padEnd(30)} ${String(own.length).padStart(3)} chunks, ` +
        `largest ~${largest} tokens  [${status}]`,
    );
  }
  if (dryRun) {
    console.log('\nDry run: nothing embedded or written.');
    return;
  }
  if (!isGeminiConfigured()) {
    throw new Error(
      'GEMINI_API_KEY is not set (needed for embeddings). Use --dry-run to only check chunking.',
    );
  }

  console.log(
    `\nEmbedding with ${env.GEMINI_EMBED_MODEL} (${env.GEMINI_EMBED_DIMENSIONS} dimensions), ` +
      `batches of ${batchSize}...`,
  );
  const startedAt = Date.now();
  const vectors = await embedTexts(
    chunks.map((chunk) => chunk.text),
    {
      kind: 'document',
      titles: chunks.map((chunk) => `${chunk.schemeName}: ${chunk.section}`),
      batchSize,
      // A script can afford to wait out rate limits.
      maxRetries: 6,
      maxDelayMs: 60_000,
      onBatch: (done, total) => console.log(`  embedded ${done}/${total}`),
    },
  );

  const file = buildVectorStoreFile(
    {
      version: 1,
      createdAt: new Date().toISOString(),
      embedModel: env.GEMINI_EMBED_MODEL,
      dimensions: env.GEMINI_EMBED_DIMENSIONS,
      sourceFingerprint: fingerprintDocuments(documents),
      chunking: DEFAULT_CHUNKING,
      documents: documents.map(
        ({ schemeId, schemeName, sourceFile, officialUrl, sample, verified }) => ({
          schemeId,
          schemeName,
          sourceFile,
          officialUrl,
          sample,
          verified,
        }),
      ),
    },
    chunks,
    vectors,
  );
  await writeVectorStore(PATHS.vectorStore, file);
  console.log(
    `\nWrote ${relative(PATHS.vectorStore)} in ${((Date.now() - startedAt) / 1000).toFixed(1)} s. ` +
      'Restart the server to load it.',
  );
}

main().catch((error: unknown) => {
  console.error(`\nIngestion failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
