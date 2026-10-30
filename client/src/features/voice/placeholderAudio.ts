/**
 * A silent 8 kHz mono 16-bit WAV (0.2 to 1 s long) that stands in for a recording when the
 * browser mocks run on a device without a usable microphone.
 */
export function createPlaceholderAudio(durationMs: number): Blob {
  const sampleRate = 8000;
  const seconds = Math.min(Math.max(durationMs, 200), 1000) / 1000;
  const dataBytes = Math.round(seconds * sampleRate) * 2;
  const view = new DataView(new ArrayBuffer(44 + dataBytes));
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);
  // Samples stay zero: silence.

  return new Blob([view], { type: 'audio/wav' });
}
