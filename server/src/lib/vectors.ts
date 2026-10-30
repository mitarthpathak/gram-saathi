/** Vector helpers for retrieval: normalization, cosine similarity, compact storage. */

/** Scales a vector to length 1 (a zero vector stays zero). */
export function normalizeVector(values: ArrayLike<number>): Float32Array {
  const vector = Float32Array.from(values);
  let sumOfSquares = 0;
  for (const value of vector) sumOfSquares += value * value;
  const norm = Math.sqrt(sumOfSquares);
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) vector[i] /= norm;
  }
  return vector;
}

/** Cosine similarity in [-1, 1]; 0 when either vector is all zeros. */
export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) {
    throw new Error(`Vector lengths differ: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Float32 vector -> base64 (4 bytes per dimension instead of ~10 characters of JSON). */
export function encodeVector(vector: Float32Array): string {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength).toString('base64');
}

export function decodeVector(encoded: string): Float32Array {
  // Copy into a fresh buffer: Float32Array needs a 4-byte aligned offset.
  const bytes = new Uint8Array(Buffer.from(encoded, 'base64'));
  return new Float32Array(bytes.buffer, 0, bytes.byteLength / 4);
}
