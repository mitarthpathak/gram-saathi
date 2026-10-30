import { afterEach, describe, expect, it } from 'vitest';
import { GeminiError, setGeminiBackend } from '../src/lib/geminiClient';
import { SMS_SYSTEM_PROMPT } from '../src/modules/sms/prompts';
import {
  compressForSms,
  countSmsSegments,
  prepareForSms,
  truncateAtSentence,
  truncateToSegments,
} from '../src/modules/sms/service';
import { fakeGemini } from './fakeGemini';

describe('countSmsSegments', () => {
  it('GSM-7 text: 160 characters in one SMS, 153 per part when split', () => {
    expect(countSmsSegments('')).toBe(0);
    expect(countSmsSegments('a'.repeat(160))).toBe(1);
    expect(countSmsSegments('a'.repeat(161))).toBe(2);
    expect(countSmsSegments('a'.repeat(306))).toBe(2);
    expect(countSmsSegments('a'.repeat(307))).toBe(3);
  });

  it('counts GSM-7 extension characters (€ [ ] { } ...) twice', () => {
    expect(countSmsSegments('€'.repeat(80))).toBe(1);
    expect(countSmsSegments('€'.repeat(81))).toBe(2);
  });

  it('Unicode text (all Indic scripts, or any non-GSM character): 70, then 67 per part', () => {
    expect(countSmsSegments('क'.repeat(70))).toBe(1);
    expect(countSmsSegments('क'.repeat(71))).toBe(2);
    expect(countSmsSegments('த'.repeat(134))).toBe(2);
    expect(countSmsSegments('த'.repeat(135))).toBe(3);
    // One "₹" turns an otherwise English SMS into Unicode.
    expect(countSmsSegments(`${'a'.repeat(70)}₹`)).toBe(2);
  });
});

describe('prepareForSms', () => {
  it('makes English GSM-7 safe: Rs for ₹, plain quotes, dashes and dots, one line', () => {
    const sms = prepareForSms('Get ₹6,000 – “free”…\n  at a CSC', 'en');
    expect(sms).toBe('Get Rs 6,000 - "free"... at a CSC');
    expect(countSmsSegments(sms)).toBe(1);
  });

  it('keeps ₹ in Indic languages (Unicode anyway)', () => {
    expect(prepareForSms('₹6,000   सालाना', 'hi')).toBe('₹6,000 सालाना');
  });
});

describe('truncation fallbacks', () => {
  const hindi =
    'पीएम-किसान में हर साल ₹6,000 मिलते हैं। यह पैसा तीन किस्तों में सीधे बैंक खाते में आता है। पंजीकरण मुफ़्त है और नज़दीकी CSC केंद्र पर होता है। eKYC ज़रूरी है।';

  it('keeps the longest run of whole sentences that fits', () => {
    const sms = truncateAtSentence(hindi, 2);
    expect(countSmsSegments(sms)).toBeLessThanOrEqual(2);
    expect(sms.endsWith('।')).toBe(true);
    expect(hindi.startsWith(sms)).toBe(true);
  });

  it('cuts at a word boundary with "..." when even one sentence is too long', () => {
    const sms = truncateToSegments('word '.repeat(100), 1);
    expect(sms.endsWith('...')).toBe(true);
    expect(countSmsSegments(sms)).toBe(1);
    expect(sms).not.toMatch(/wor\.\.\.$/);
  });
});

describe('compressForSms', () => {
  afterEach(() => setGeminiBackend(undefined));
  const long = `${'PM-KISAN pays Rs 6,000 a year in three instalments. '.repeat(8)}Apply at a CSC.`;

  it('returns short text as it is, without calling the model', async () => {
    const fake = fakeGemini();
    setGeminiBackend(fake);
    expect(await compressForSms({ text: 'PM-KISAN pays ₹6,000 a year.', language: 'en' })).toEqual({
      sms: 'PM-KISAN pays Rs 6,000 a year.',
      segments: 1,
    });
    expect(fake.calls).toHaveLength(0);
  });

  it('uses the model rewrite and tells it the character budget', async () => {
    const fake = fakeGemini(() => ({ sms: 'PM-KISAN: Rs 6000/year in 3 parts. Apply at CSC.' }));
    setGeminiBackend(fake);
    const result = await compressForSms({ text: long, language: 'en' });
    expect(result).toEqual({
      sms: 'PM-KISAN: Rs 6000/year in 3 parts. Apply at CSC.',
      segments: 1,
    });
    expect(fake.calls[0].system).toBe(SMS_SYSTEM_PROMPT);
    expect(String(fake.calls[0].input)).toContain('CHARACTER LIMIT: 275'); // 90% of 2 x 153
  });

  it('still enforces the limit when the model writes too much', async () => {
    setGeminiBackend(fakeGemini(() => ({ sms: long })));
    const result = await compressForSms({ text: long, language: 'en' });
    expect(result.segments).toBeLessThanOrEqual(2);
    expect(result.sms.endsWith('.')).toBe(true);
  });

  it('falls back to a sentence cut when the model fails', async () => {
    setGeminiBackend(
      fakeGemini(() => {
        throw new GeminiError('unavailable', 'down');
      }),
    );
    const result = await compressForSms({ text: long, language: 'en' });
    expect(result.segments).toBeLessThanOrEqual(2);
    expect(long.startsWith(result.sms)).toBe(true);
  });
});
