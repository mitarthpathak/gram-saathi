import { env, isMocked } from '../src/config/env';
import { HttpError } from '../src/lib/httpError';
import { searchSchemes } from '../src/modules/rag/service';

interface CalibrationCase {
  label: string;
  language: 'hi' | 'mr' | 'ta' | 'en';
  queryEn: string;
}

export const SCHEME_CASES: CalibrationCase[] = [
  { label: 'PM-KISAN eligibility', language: 'hi', queryEn: 'What does the PM-KISAN document say about eligibility?' },
  { label: 'PM-KISAN application', language: 'en', queryEn: 'How does the PM-KISAN document explain how to apply?' },
  { label: 'Ayushman card', language: 'mr', queryEn: 'What does the Ayushman Bharat document say about its card?' },
  { label: 'Ayushman eligibility', language: 'ta', queryEn: 'What does the Ayushman Bharat document say about eligibility?' },
  { label: 'MGNREGA work', language: 'hi', queryEn: 'What does the MGNREGA document say about work?' },
  { label: 'PMAY-Gramin', language: 'en', queryEn: 'What does the PMAY-Gramin document explain?' },
  { label: 'Ujjwala', language: 'mr', queryEn: 'What does the PM Ujjwala document say about applying?' },
  { label: 'Atal Pension', language: 'ta', queryEn: 'What does the Atal Pension Yojana document say about the scheme?' },
  { label: 'Suraksha Bima', language: 'hi', queryEn: 'What does the PM Suraksha Bima document say about enrollment?' },
  { label: 'PM-KISAN benefit', language: 'en', queryEn: 'What does the PM-KISAN document say about its benefit?' },
];

export const NON_SCHEME_CASES: CalibrationCase[] = [
  { label: 'greeting', language: 'en', queryEn: 'hello' },
  { label: 'thanks', language: 'en', queryEn: 'thank you' },
  { label: 'identity', language: 'hi', queryEn: 'kaun ho tum' },
  { label: 'clarification', language: 'hi', queryEn: 'ki keh raho he' },
  { label: 'not understood', language: 'hi', queryEn: 'samajh nahi aaya' },
  { label: 'weather', language: 'en', queryEn: 'What is the weather today?' },
  { label: 'sports', language: 'mr', queryEn: 'Who won the cricket match?' },
  { label: 'recipe', language: 'ta', queryEn: 'How do I cook rice?' },
  { label: 'directions', language: 'en', queryEn: 'How do I reach the railway station?' },
  { label: 'general knowledge', language: 'en', queryEn: 'What is the capital of France?' },
];

export interface ScoreGroup {
  label: string;
  scores: number[];
}

export function recommendThreshold(schemeScores: number[], nonSchemeScores: number[]): {
  threshold: number;
  separated: boolean;
  schemeMin: number;
  nonSchemeMax: number;
} {
  if (!schemeScores.length || !nonSchemeScores.length) throw new Error('Both calibration groups need scores.');
  const schemeMin = Math.min(...schemeScores);
  const nonSchemeMax = Math.max(...nonSchemeScores);
  if (schemeMin > nonSchemeMax) {
    return { threshold: (schemeMin + nonSchemeMax) / 2, separated: true, schemeMin, nonSchemeMax };
  }

  const values = [...schemeScores, ...nonSchemeScores];
  const thresholds = [...new Set(values)].sort((a, b) => a - b);
  let best = { threshold: thresholds[0], accuracy: -1 };
  for (const threshold of thresholds) {
    const schemeRecall = schemeScores.filter((score) => score >= threshold).length / schemeScores.length;
    const nonSchemeRecall = nonSchemeScores.filter((score) => score < threshold).length / nonSchemeScores.length;
    const balancedAccuracy = (schemeRecall + nonSchemeRecall) / 2;
    if (balancedAccuracy > best.accuracy) best = { threshold, accuracy: balancedAccuracy };
  }
  return { threshold: best.threshold, separated: false, schemeMin, nonSchemeMax };
}

async function collect(cases: CalibrationCase[]): Promise<ScoreGroup[]> {
  const groups: ScoreGroup[] = [];
  for (const testCase of cases) {
    const chunks = await searchSchemes({ query: testCase.queryEn, language: 'en', skipTranslation: true });
    groups.push({ label: `${testCase.language} ${testCase.label}`, scores: chunks.map((chunk) => chunk.score) });
  }
  return groups;
}

async function main(): Promise<void> {
  if (isMocked('rag')) throw new Error('Calibration requires real RAG: run with USE_MOCKS=false.');
  const scheme = await collect(SCHEME_CASES);
  const nonScheme = await collect(NON_SCHEME_CASES);
  const schemeScores = scheme.flatMap((group) => group.scores.slice(0, 1));
  const nonSchemeScores = nonScheme.flatMap((group) => group.scores.slice(0, 1));
  printGroup('Scheme questions (best chunk score)', scheme);
  printGroup('Non-scheme messages (best chunk score)', nonScheme);
  const recommendation = recommendThreshold(schemeScores, nonSchemeScores);
  console.log(`\nCurrent RAG_MIN_SCORE=${env.RAG_MIN_SCORE}`);
  console.log(`Recommended RAG_MIN_SCORE=${recommendation.threshold.toFixed(4)} (${recommendation.separated ? 'groups separate on this sample' : 'groups overlap; balanced-accuracy choice'})`);
  console.log(`Scheme minimum=${recommendation.schemeMin.toFixed(4)}; non-scheme maximum=${recommendation.nonSchemeMax.toFixed(4)}`);
  console.log('Calibration is a sample recommendation, not an accuracy guarantee.');
}

function printGroup(title: string, groups: ScoreGroup[]): void {
  const scores = groups.flatMap((group) => group.scores.slice(0, 1));
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  console.log(`\n${title}: ${scores.length} queries`);
  console.log(`  min=${Math.min(...scores).toFixed(4)} median=${median.toFixed(4)} max=${Math.max(...scores).toFixed(4)}`);
  for (const group of groups) console.log(`  ${group.label.padEnd(32)} ${group.scores[0]?.toFixed(4) ?? 'no hits'}`);
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/calibrate-rag.ts')) {
  main().catch((error: unknown) => {
    if (error instanceof HttpError) console.error(`${error.status} ${error.code}: ${error.message}`);
    else console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
