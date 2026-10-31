/**
 * Gold set for the audit. Questions come from repo data only:
 * - scheme questions: data/faq/questions.json (team-written, all four languages);
 * - non-scheme messages: server/eval/testset.json (includes "ki keh raho he").
 * server/eval/audit-goldset.json maps each FAQ id to the scheme that answers it.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { LanguageCode } from '@gram-saathi/shared';
import { PATHS } from '../../src/config/env';

export const AUDIT_LANGUAGES: LanguageCode[] = ['hi', 'mr', 'ta', 'en'];

export interface GoldQuestion {
  faqId: string;
  language: LanguageCode;
  text: string;
  expectedSchemeId: string;
}

export interface NonSchemeCase {
  id: string;
  text: string;
  language: LanguageCode;
  expectedIntent: string;
}

export interface GoldSet {
  questions: GoldQuestion[];
  nonScheme: NonSchemeCase[];
  dialectQuestionFaqId: string;
  followUpFaqId: string;
  clarifyMessages: string[];
}

interface FaqSeedFile {
  items: { id: string; question: Record<LanguageCode, string> }[];
}

interface GoldMapFile {
  faqSchemes: Record<string, string>;
  dialectQuestionFaqId: string;
  followUpFaqId: string;
  clarifyMessages: string[];
}

interface TestsetFile {
  nonSchemeMessages: NonSchemeCase[];
}

const serverRoot = path.resolve(__dirname, '../..');

export function loadGoldSet(): GoldSet {
  const faq = JSON.parse(readFileSync(PATHS.faqSeeds, 'utf8')) as FaqSeedFile;
  const map = JSON.parse(
    readFileSync(path.join(serverRoot, 'eval/audit-goldset.json'), 'utf8'),
  ) as GoldMapFile;
  const testset = JSON.parse(
    readFileSync(path.join(serverRoot, 'eval/testset.json'), 'utf8'),
  ) as TestsetFile;

  const questions: GoldQuestion[] = [];
  for (const item of faq.items) {
    const expectedSchemeId = map.faqSchemes[item.id];
    if (!expectedSchemeId)
      throw new Error(`audit-goldset.json has no scheme for FAQ id "${item.id}"`);
    for (const language of AUDIT_LANGUAGES) {
      const text = item.question[language];
      if (text?.trim()) questions.push({ faqId: item.id, language, text, expectedSchemeId });
    }
  }
  return {
    questions,
    nonScheme: testset.nonSchemeMessages,
    dialectQuestionFaqId: map.dialectQuestionFaqId,
    followUpFaqId: map.followUpFaqId,
    clarifyMessages: map.clarifyMessages,
  };
}
