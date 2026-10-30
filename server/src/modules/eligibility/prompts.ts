import type { LanguageCode } from '@gram-saathi/shared';
import { z } from 'zod';
import { describeLanguage } from '../../lib/languages';
import type { FlowQuestion } from './rules';

/** Used only for texts a rule file has no reviewed translation for. */
export const TRANSLATE_UI_PROMPT = `You translate short texts for a voice app that checks eligibility for Indian government schemes. The people using it live in villages and many read little.

- Translate each text into the TARGET LANGUAGE and its usual script, in simple everyday spoken words.
- Keep numbers, ₹ amounts, scheme names, website addresses and phone numbers exactly as they are.
- A question stays a question; keep hints such as "(in years)".
- Return exactly one translation per input text, in the same order.`;

export function buildTranslateInput(texts: string[], language: LanguageCode): string {
  return `TARGET LANGUAGE: ${describeLanguage(language)}\n\nTEXTS (JSON array):\n${JSON.stringify(texts, null, 2)}`;
}

export const translationsSchema = z.object({
  translations: z.array(z.string()).describe('One translation per input text, in the same order.'),
});

/** Turns one free-form (often spoken) answer into the value the rules need. */
export const PARSE_ANSWER_PROMPT = `You read one answer given in an eligibility check for Indian government schemes and turn it into a value. The answer may be Hindi, Marathi, Tamil, English or a mix, in any script, and is often a speech transcript.

- Use only what the answer says. If it is unclear, off-topic, or "I don't know", set understood to false.
- Number questions: give the number in the unit asked for. Turn number words into digits ("paintees" = 35, "do" = 2) and convert other units with the NOTES. "None", "no land" or "landless" = 0.
- Yes/no questions: true for yes, false for no. A statement that clearly answers the question counts ("main kisaan hu" to "Are you a farmer?" = true).
- Choice questions: the option value that matches the answer.`;

export function buildParseInput(question: FlowQuestion, answer: string): string {
  const lines = [`QUESTION: ${question.text.en}`];
  switch (question.type) {
    case 'number':
      lines.push(
        `EXPECTED: a number${question.unit ? ` in ${question.unit}` : ''} from ${question.min ?? 0} to ${question.max ?? 'any'}`,
      );
      break;
    case 'boolean':
      lines.push('EXPECTED: yes (true) or no (false)');
      break;
    case 'choice':
      lines.push(
        'EXPECTED: one of these option values:',
        ...(question.options ?? []).map((option) => `- ${option.value}: ${option.label.en}`),
      );
      break;
  }
  if (question.parseHint) lines.push(`NOTES: ${question.parseHint}`);
  lines.push(`ANSWER: ${answer}`);
  return lines.join('\n');
}

export const understoodSchema = z
  .boolean()
  .describe('false if the answer is unclear, off-topic or "I don\'t know".');
