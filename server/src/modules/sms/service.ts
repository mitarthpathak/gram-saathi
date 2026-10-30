import type { SmsCompressRequest, SmsCompressResponse } from '@gram-saathi/shared';
import { isMocked } from '../../config/env';
import { NotImplementedError } from '../../lib/httpError';

/** Segment budget: 2 Unicode SMS fit 134 Hindi/Marathi/Tamil characters, 2 GSM-7 SMS fit 306. */
export const MAX_SMS_SEGMENTS = 2;

export async function compressForSms(request: SmsCompressRequest): Promise<SmsCompressResponse> {
  if (isMocked('sms')) {
    const sms = truncateToSegments(request.text, MAX_SMS_SEGMENTS);
    return { sms, segments: countSmsSegments(sms) };
  }
  // TODO(step-2): ask Gemini to rewrite request.text in request.language within
  //   MAX_SMS_SEGMENTS, keeping amounts, dates, websites and helpline numbers; fall back to
  //   truncateToSegments(). In English prefer "Rs" over "₹": ₹ is not in GSM-7 and would make
  //   the whole SMS Unicode.
  throw new NotImplementedError('sms.compressForSms');
}

// GSM 03.38 alphabet: basic characters cost 1 unit, extension-table characters cost 2.
const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXTENDED = '^{}\\[~]|€\f';

/**
 * Number of SMS segments `text` needs. Real logic, not a mock: GSM-7 text fits 160
 * characters (153 per segment when split); anything else is sent as UCS-2 Unicode, which
 * fits 70 (67 per segment). Every Hindi, Marathi or Tamil SMS is Unicode.
 */
export function countSmsSegments(text: string): number {
  if (text.length === 0) return 0;
  let gsmUnits = 0;
  for (const char of text) {
    if (GSM7_BASIC.includes(char)) gsmUnits += 1;
    else if (GSM7_EXTENDED.includes(char)) gsmUnits += 2;
    // UCS-2 counts UTF-16 code units, which is exactly what String#length measures.
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
