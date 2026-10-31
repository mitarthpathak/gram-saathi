import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { evalSet, liveRows, offlineRows, printRows } from '../scripts/eval';

describe('evaluation harness', () => {
  it('checks offline conversation plumbing or prints advisory live model results', async () => {
    const live = process.env.EVAL_MODE?.toLowerCase() === 'live';
    if (live && !env.GEMINI_API_KEY) {
      console.log('Live evaluation skipped: GEMINI_API_KEY is not configured in the environment.');
      return;
    }
    const rows = live ? await liveRows() : await offlineRows();
    printRows(live ? 'live' : 'offline', rows);
    expect(evalSet.schemeQuestions).toHaveLength(10);
    expect(Object.keys(evalSet.languages)).toEqual(['hi', 'mr', 'ta', 'en']);
    expect(evalSet.nonSchemeMessages).toHaveLength(10);
    expect(rows).toHaveLength(50);
    if (!live) expect(rows.every((row) => row.passed)).toBe(true);
  });
});
