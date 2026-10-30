import type { LanguageCode } from '@gram-saathi/shared';
import { generateJson, GeminiError, isGeminiConfigured } from '../../lib/geminiClient';
import { logger } from '../../lib/logger';
import { buildTranslateInput, TRANSLATE_UI_PROMPT, translationsSchema } from './prompts';
import type { LocalizedText } from './rules';

/** Machine translations of rule texts, by language + English text. Lives as long as the process. */
const translations = new Map<string, string>();
const key = (language: LanguageCode, english: string) => `${language}\n${english}`;

/**
 * Each text in `language`: the reviewed translation from the rule file if there is one, else a
 * Gemini translation (one call for all missing texts, then cached), else the English text.
 */
export async function localize(texts: LocalizedText[], language: LanguageCode): Promise<string[]> {
  const missing = [
    ...new Set(
      texts
        .filter((text) => !text[language] && !translations.has(key(language, text.en)))
        .map((text) => text.en),
    ),
  ];
  if (missing.length > 0) await translate(missing, language);
  return texts.map((text) => text[language] ?? translations.get(key(language, text.en)) ?? text.en);
}

async function translate(texts: string[], language: LanguageCode): Promise<void> {
  if (!isGeminiConfigured()) {
    logger.warn(
      `No ${language} text for ${texts.length} eligibility text(s) and no GEMINI_API_KEY: showing English`,
    );
    return;
  }
  try {
    const { translations: translated } = await generateJson({
      label: 'translate-eligibility',
      system: TRANSLATE_UI_PROMPT,
      input: buildTranslateInput(texts, language),
      schema: translationsSchema,
      maxOutputTokens: 4096,
    });
    if (translated.length !== texts.length) {
      throw new GeminiError(
        'bad_response',
        `Asked for ${texts.length} translations, got ${translated.length}`,
      );
    }
    texts.forEach((text, index) => translations.set(key(language, text), translated[index].trim()));
  } catch (error) {
    logger.warn(
      `Translating eligibility texts to ${language} failed, showing English: ${String(error)}`,
    );
  }
}

/** For tests. */
export function clearTranslations(): void {
  translations.clear();
}
