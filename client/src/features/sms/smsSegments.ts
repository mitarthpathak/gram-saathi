// Same logic as server/src/modules/sms/service.ts, used for live counts and the browser mocks.

const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXTENDED = '^{}\\[~]|€\f';

/**
 * SMS segments needed for `text`: GSM-7 fits 160 characters (153 per part when split),
 * anything else is sent as Unicode with 70 (67 per part). Every Indic-script SMS is Unicode.
 */
export function countSmsSegments(text: string): number {
  if (text.length === 0) return 0;
  let gsmUnits = 0;
  for (const char of text) {
    if (GSM7_BASIC.includes(char)) gsmUnits += 1;
    else if (GSM7_EXTENDED.includes(char)) gsmUnits += 2;
    else return text.length <= 70 ? 1 : Math.ceil(text.length / 67);
  }
  return gsmUnits <= 160 ? 1 : Math.ceil(gsmUnits / 153);
}

/** Cuts `text` at a word boundary so it fits `maxSegments`, ending with "..." (GSM-safe). */
export function truncateToSegments(text: string, maxSegments: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (countSmsSegments(clean) <= maxSegments) return clean;

  let end = clean.length;
  while (end > 0 && countSmsSegments(`${clean.slice(0, end).trimEnd()}...`) > maxSegments) {
    const lastSpace = clean.lastIndexOf(' ', end - 1);
    end = lastSpace > 0 ? lastSpace : end - 1;
  }
  return `${clean.slice(0, end).trimEnd()}...`;
}
