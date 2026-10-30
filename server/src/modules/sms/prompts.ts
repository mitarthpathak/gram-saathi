import type { LanguageCode } from '@gram-saathi/shared';
import { z } from 'zod';
import { describeLanguage } from '../../lib/languages';

export const SMS_SYSTEM_PROMPT = `You turn an answer about an Indian government scheme into ONE short SMS for a basic keypad phone.

Rules:
- Use the same language and script as the input text.
- Stay within the CHARACTER LIMIT (count every character, spaces included). Shorter is better.
- Keep the key facts: scheme name, amounts, who can apply, where to apply, websites and helpline numbers. Drop greetings and filler.
- Never add a fact that is not in the input.
- Plain text on one line: no emojis, no markdown, no line breaks.
- For English: write "Rs" instead of "₹" and use only plain ASCII punctuation.`;

export function buildSmsInput(text: string, language: LanguageCode, maxChars: number): string {
  return `LANGUAGE: ${describeLanguage(language)}\nCHARACTER LIMIT: ${maxChars}\n\nTEXT:\n${text}`;
}

export const smsSchema = z.object({
  sms: z.string().describe('The SMS text.'),
});
