/**
 * Small in-memory LRU cache with optional expiry, per server process (cleared on restart).
 * The chat module keys it by normalized question + language, so repeated questions are
 * instant and cost no AI calls.
 *
 * TODO(step-3): semantic cache: also hit on paraphrases by comparing question embeddings,
 * and persist entries if we run more than one server instance.
 */
export class LruCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  /** `ttlMs` 0 = entries never expire. `maxEntries` 0 = caching disabled. */
  constructor(options: { maxEntries: number; ttlMs: number }) {
    this.maxEntries = options.maxEntries;
    this.ttlMs = options.ttlMs;
  }

  get size(): number {
    return this.entries.size;
  }

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Re-insert so the Map's insertion order doubles as recency order.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.maxEntries === 0) return;
    this.entries.delete(key);
    this.entries.set(key, {
      value,
      expiresAt: this.ttlMs > 0 ? Date.now() + this.ttlMs : Number.POSITIVE_INFINITY,
    });
    while (this.entries.size > this.maxEntries) {
      // The first key in iteration order is the least recently used.
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
  }
}
