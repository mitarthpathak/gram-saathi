/** localStorage wrapper that never throws (private mode, storage disabled, quota full). */
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Not critical: the app works without persistence.
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Not critical: the app works without persistence.
    }
  },

  getJson<T>(key: string): T | null {
    const raw = storage.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  setJson(key: string, value: unknown): void {
    storage.set(key, JSON.stringify(value));
  },
};
