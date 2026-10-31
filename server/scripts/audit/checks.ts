/** Pure helpers for the pipeline audit. Unit-tested in test/audit.test.ts. */
import type { LanguageCode } from '@gram-saathi/shared';
import type { Status } from './types';

// ---------------------------------------------------------------------------
// Status aggregation
// ---------------------------------------------------------------------------

/**
 * One status for a group of checks: any FAIL wins; identical statuses stay; PASS mixed with
 * anything else is PARTIAL; otherwise the least proven status (NOT-TESTED, then NEEDS-HUMAN,
 * then MOCK-ONLY, then SYNTHETIC-ONLY).
 */
export function aggregateStatus(statuses: Status[]): Status {
  if (statuses.length === 0) return 'NOT-TESTED';
  if (statuses.includes('FAIL')) return 'FAIL';
  const unique = [...new Set(statuses)];
  if (unique.length === 1) return unique[0];
  if (unique.includes('PASS') || unique.includes('PARTIAL')) return 'PARTIAL';
  for (const weakest of ['NOT-TESTED', 'NEEDS-HUMAN', 'MOCK-ONLY', 'SYNTHETIC-ONLY'] as const) {
    if (unique.includes(weakest)) return weakest;
  }
  return 'PARTIAL';
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/** Nearest-rank percentile (p in 0..100) of `values`; undefined when empty. */
export function percentile(values: number[], p: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

export interface Distribution {
  count: number;
  min?: number;
  p25?: number;
  median?: number;
  p75?: number;
  max?: number;
}

export function distribution(values: number[]): Distribution {
  return {
    count: values.length,
    min: percentile(values, 0),
    p25: percentile(values, 25),
    median: percentile(values, 50),
    p75: percentile(values, 75),
    max: percentile(values, 100),
  };
}

export function formatDistribution(d: Distribution, digits = 3): string {
  if (d.count === 0) return 'no values';
  const f = (value: number | undefined) => (value === undefined ? '-' : value.toFixed(digits));
  return `n=${d.count} min ${f(d.min)} · p25 ${f(d.p25)} · median ${f(d.median)} · p75 ${f(d.p75)} · max ${f(d.max)}`;
}

/** Longest chain of calls where each starts after the previous one ended. */
export function sequentialDepth(calls: { startedAt: number; durationMs: number }[]): number {
  const sorted = [...calls].sort((a, b) => a.startedAt - b.startedAt);
  const depth: number[] = [];
  sorted.forEach((call, i) => {
    let best = 0;
    for (let j = 0; j < i; j++) {
      if (sorted[j].startedAt + sorted[j].durationMs <= call.startedAt)
        best = Math.max(best, depth[j]);
    }
    depth[i] = best + 1;
  });
  return Math.max(0, ...depth);
}

// ---------------------------------------------------------------------------
// Text: scripts, Roman words, character error rate
// ---------------------------------------------------------------------------

export function scriptCounts(text: string): { devanagari: number; tamil: number; latin: number } {
  return {
    devanagari: (text.match(/[ऀ-ॿ]/gu) ?? []).length,
    tamil: (text.match(/[஀-௿]/gu) ?? []).length,
    latin: (text.match(/[A-Za-z]/g) ?? []).length,
  };
}

/** The script a reply in `language` must use: Devanagari for hi/mr, Tamil for ta, Latin for en. */
export function expectedScript(language: LanguageCode): 'devanagari' | 'tamil' | 'latin' {
  if (language === 'ta') return 'tamil';
  return language === 'en' ? 'latin' : 'devanagari';
}

/** Tokens that may stay in Latin letters inside an Indic reply. */
const ALWAYS_ALLOWED_LATIN = new Set([
  'otp',
  'pin',
  'csc',
  'ekyc',
  'kyc',
  'dbt',
  'sms',
  'id',
  'atm',
  'upi',
  'aadhaar',
  'pm',
  'gram',
  'saathi',
]);

/**
 * Latin-letter words in an Indic reply that are not allowed: words inside URLs/domains, all-caps
 * acronyms (OTP, CSC, PM-KISAN), the allow-list above and words of `extraAllowed` (scheme names)
 * do not count.
 */
export function romanWords(text: string, extraAllowed: string[] = []): string[] {
  const allowed = new Set([
    ...ALWAYS_ALLOWED_LATIN,
    ...extraAllowed.flatMap((name) => name.toLowerCase().match(/[a-z]+/g) ?? []),
  ]);
  const withoutUrls = text.replace(
    /(?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?:gov\.in|nic\.in|org\.in|co\.in|in|com|org|net)\S*/giu,
    ' ',
  );
  const words = withoutUrls.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  return words.filter((word) => {
    const parts = word.split(/[-']/).filter(Boolean);
    return !parts.every(
      (part) =>
        allowed.has(part.toLowerCase()) || (part.length >= 2 && part === part.toUpperCase()),
    );
  });
}

/** Lower case, NFC, no punctuation (incl. danda), single spaces. */
export function normalizeForCer(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}।॥]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein distance over code points. */
export function editDistance(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  let previous = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const current = [i];
    for (let j = 1; j <= y.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[y.length];
}

/** Normalized character error rate of `hypothesis` against `reference` (0 = identical). */
export function characterErrorRate(reference: string, hypothesis: string): number {
  const ref = normalizeForCer(reference);
  const hyp = normalizeForCer(hypothesis);
  if (ref.length === 0) return hyp.length === 0 ? 0 : 1;
  return editDistance(ref, hyp) / [...ref].length;
}

export function excerpt(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

export interface WavInfo {
  valid: boolean;
  error?: string;
  audioFormat?: number;
  channels?: number;
  sampleRate?: number;
  bitsPerSample?: number;
  dataBytes?: number;
  durationSec?: number;
}

/** Reads a RIFF/WAVE header and the data chunk size. */
export function parseWav(buffer: Buffer): WavInfo {
  if (buffer.length < 12) return { valid: false, error: 'shorter than a RIFF header' };
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return { valid: false, error: 'missing RIFF/WAVE signature' };
  }
  let offset = 12;
  let format: Omit<WavInfo, 'valid'> | undefined;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      if (body + 16 > buffer.length) return { valid: false, error: 'truncated fmt chunk' };
      format = {
        audioFormat: buffer.readUInt16LE(body),
        channels: buffer.readUInt16LE(body + 2),
        sampleRate: buffer.readUInt32LE(body + 4),
        bitsPerSample: buffer.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      if (!format) return { valid: false, error: 'data chunk before fmt chunk' };
      // Streaming writers may leave the size as 0 or 0xFFFFFFFF: fall back to the bytes present.
      const available = buffer.length - body;
      const dataBytes = size === 0 || size === 0xffffffff || size > available ? available : size;
      const bytesPerSecond =
        (format.sampleRate ?? 0) * (format.channels ?? 0) * ((format.bitsPerSample ?? 0) / 8);
      if (bytesPerSecond <= 0) return { valid: false, error: 'invalid fmt values' };
      return { valid: true, ...format, dataBytes, durationSec: dataBytes / bytesPerSecond };
    }
    offset = body + size + (size % 2);
  }
  return { valid: false, error: 'no data chunk' };
}

/** A silent 16-bit mono PCM WAV of `ms` milliseconds. */
export function silentWav(ms: number, sampleRate = 16_000): Buffer {
  const samples = Math.round((sampleRate * ms) / 1000);
  const data = Buffer.alloc(samples * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/**
 * Whether a clip length is plausible for reading `text` aloud: between 2 and 30 characters per
 * second of audio (wide on purpose; it catches empty or truncated audio, not accents).
 */
export function plausibleDuration(
  text: string,
  seconds: number,
): { plausible: boolean; charsPerSecond: number } {
  const chars = [...text.replace(/\s+/g, ' ').trim()].length;
  const charsPerSecond = seconds > 0 ? chars / seconds : Infinity;
  return {
    plausible: seconds > 0.3 && charsPerSecond >= 2 && charsPerSecond <= 30,
    charsPerSecond,
  };
}

/** Decodes a `data:<mime>;base64,<data>` URL. */
export function decodeDataUrl(url: string): { mimeType: string; bytes: Buffer } | undefined {
  const match = /^data:([^;,]+)(?:;[^,]*)?;base64,(.*)$/s.exec(url);
  if (!match) return undefined;
  return { mimeType: match[1], bytes: Buffer.from(match[2], 'base64') };
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export function toCsv(rows: string[][]): string {
  const cell = (value: string) =>
    /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  return rows.map((row) => row.map(cell).join(',')).join('\n') + '\n';
}
