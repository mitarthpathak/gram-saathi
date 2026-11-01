/**
 * Minimal PCM WAV helpers for server speech: read a RIFF/WAVE buffer, wrap raw 16-bit PCM in a
 * header, and join several clips (same format) into one file. No dependencies.
 */

export interface PcmAudio {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  /** Interleaved little-endian PCM samples. */
  data: Buffer;
}

const PCM_FORMAT = 1;

export function isWav(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE'
  );
}

/** Reads an uncompressed PCM WAV. Returns undefined for anything else (or a truncated file). */
export function parseWav(buffer: Buffer): PcmAudio | undefined {
  if (!isWav(buffer)) return undefined;
  let format: Omit<PcmAudio, 'data'> | undefined;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const declared = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    // Streamed WAVs may declare 0 or 0xFFFFFFFF for the data size: take what is there.
    const size = Math.min(declared, buffer.length - start);
    if (id === 'fmt ' && size >= 16) {
      if (buffer.readUInt16LE(start) !== PCM_FORMAT) return undefined;
      format = {
        channels: buffer.readUInt16LE(start + 2),
        sampleRate: buffer.readUInt32LE(start + 4),
        bitsPerSample: buffer.readUInt16LE(start + 14),
      };
    } else if (id === 'data') {
      if (!format) return undefined;
      const length = declared === 0 || declared === 0xffffffff ? buffer.length - start : size;
      return { ...format, data: buffer.subarray(start, start + length) };
    }
    offset = start + size + (size % 2);
  }
  return undefined;
}

/** A canonical 44-byte-header PCM WAV. */
export function encodeWav(audio: PcmAudio): Buffer {
  const blockAlign = (audio.channels * audio.bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + audio.data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(PCM_FORMAT, 20);
  header.writeUInt16LE(audio.channels, 22);
  header.writeUInt32LE(audio.sampleRate, 24);
  header.writeUInt32LE(audio.sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(audio.bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(audio.data.length, 40);
  return Buffer.concat([header, audio.data]);
}

/**
 * Joins clips with `gapMs` of silence between them. Returns undefined when the clips do not share
 * one format (they cannot be joined without resampling).
 */
export function concatPcm(parts: PcmAudio[], gapMs = 0): PcmAudio | undefined {
  const [first] = parts;
  if (!first) return undefined;
  const same = parts.every(
    (part) =>
      part.sampleRate === first.sampleRate &&
      part.channels === first.channels &&
      part.bitsPerSample === first.bitsPerSample,
  );
  if (!same) return undefined;
  const blockAlign = (first.channels * first.bitsPerSample) / 8;
  const gap = Buffer.alloc(Math.round((first.sampleRate * gapMs) / 1000) * blockAlign);
  const buffers: Buffer[] = [];
  parts.forEach((part, index) => {
    if (index > 0 && gap.length > 0) buffers.push(gap);
    buffers.push(part.data);
  });
  return { ...first, data: Buffer.concat(buffers) };
}

/** Length in seconds. */
export function pcmDurationSeconds(audio: PcmAudio): number {
  const bytesPerSecond = (audio.sampleRate * audio.channels * audio.bitsPerSample) / 8;
  return bytesPerSecond > 0 ? audio.data.length / bytesPerSecond : 0;
}
