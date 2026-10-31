/**
 * Dialect replies, step 2 of 2. Step 1 (conversation.ts) writes the grounded answer in the
 * standard base language. This step rewrites ONLY its wording into the dialect's spoken form; a
 * deterministic facts lock then rejects any rewrite that lost, added or changed a number, rupee
 * amount, URL, phone number or scheme name, and anything else that fails falls back to the
 * standard answer. Pure: the model call is injected.
 */
import type { AnswerStyleReason, LanguageCode } from '@gram-saathi/shared';
import { z } from 'zod';
import { checkFactsLock, describeFacts, type FactsLockResult } from '../../lib/facts';

export type DialectReplyMode = 'off' | 'best_effort' | 'verified_only';

export interface DialectTarget {
  id: string;
  name: string;
  nativeName: string;
  parentLanguage: LanguageCode;
}

export interface RenderOptions {
  mode: DialectReplyMode;
  /** From config/dialect-render.json; only a person sets it after native review. */
  verified: boolean;
  /** Consented native examples for this dialect only, already rendered as prompt lines. */
  exemplars: string[];
  timeoutMs: number;
}

export interface RenderDeps {
  generateJson: <T>(args: {
    system: string;
    prompt: string;
    schema: z.ZodType<T>;
    timeoutMs: number;
  }) => Promise<T>;
}

export interface RenderResult {
  text: string;
  rendered: 'dialect' | 'standard';
  reason?: AnswerStyleReason;
  /** Diagnostic detail for logs and the audit; never shown to users. */
  detail?: string;
  /** True when no consented exemplar was available (best-effort wording). */
  zeroShot: boolean;
  factsLock?: FactsLockResult;
}

export const renderSchema = z.object({
  text: z.string().describe('The rewritten answer, in the dialect, native script only.'),
});

const PARENT_NAME: Record<LanguageCode, string> = {
  hi: 'Hindi',
  mr: 'Marathi',
  ta: 'Tamil',
  en: 'English',
};

const SCRIPT_NAME: Record<LanguageCode, string> = {
  hi: 'Devanagari',
  mr: 'Devanagari',
  ta: 'Tamil',
  en: 'Latin',
};

/** The tone guide for rewording. Exported so tests can check every rule is in the prompt. */
export const TONE_RULES = [
  'Sound like a friendly local helper (an ASHA didi or a panchayat helper) talking to a villager.',
  'Use respectful forms of address; never the rude "tu".',
  'Short sentences of about 15 words. Everyday words. No officialese.',
  'If the answer has a simple next step (for example where to go), keep it as the last sentence; never invent a new step.',
  'Keep every number, rupee amount, date, website, phone or helpline number and scheme name exactly as written.',
  'Use dialect words only where you are sure that is how speakers say it; otherwise keep the plain word. Never invent words.',
] as const;

export function renderSystemPrompt(target: DialectTarget, exemplars: string[]): string {
  const parent = PARENT_NAME[target.parentLanguage];
  const script = SCRIPT_NAME[target.parentLanguage];
  return `You reword a short answer about an Indian government scheme into the everyday spoken ${target.name} (${target.nativeName}) form of ${parent}, for a villager who speaks ${target.name}.
Change ONLY the wording. Do not add, drop or change any fact, condition or step.
${TONE_RULES.map((rule) => `- ${rule}`).join('\n')}
- Write in ${script} script only. Do not use Roman (English) letters except for words that are already in Roman letters in the answer (such as CSC, OTP or a website).
- Return only the reworded answer in "text".${
    exemplars.length
      ? `\nHow ${target.name} speakers phrase things (consented native examples; copy the flavour, not the content):\n${exemplars.join('\n')}`
      : ''
  }`;
}

export function renderUserPrompt(standard: string): string {
  return `Answer to reword:\n<answer>\n${standard}\n</answer>`;
}

class RenderTimeout extends Error {
  constructor() {
    super('dialect rendering timed out');
    this.name = 'RenderTimeout';
  }
}

function isTimeout(error: unknown): boolean {
  if (error instanceof RenderTimeout) return true;
  return (
    typeof error === 'object' && error !== null && (error as { kind?: unknown }).kind === 'timeout'
  );
}

/** Latin-letter words in `rewrite` that the original did not already contain. */
export function newRomanWords(original: string, rewrite: string): string[] {
  const strip = (text: string) =>
    text.replace(
      /(?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?:gov\.in|nic\.in|org\.in|co\.in|in|com|org|net)\S*/giu,
      ' ',
    );
  const allowed = new Set(
    (strip(original).match(/[A-Za-z]+/g) ?? []).map((word) => word.toLowerCase()),
  );
  return (strip(rewrite).match(/[A-Za-z]+/g) ?? []).filter(
    (word) => !allowed.has(word.toLowerCase()),
  );
}

function nativeScriptCount(text: string, language: LanguageCode): number {
  if (language === 'ta') return (text.match(/[஀-௿]/gu) ?? []).length;
  if (language === 'en') return (text.match(/[A-Za-z]/g) ?? []).length;
  return (text.match(/[ऀ-ॿ]/gu) ?? []).length;
}

/** Rewrites `standard` into the dialect, or returns it unchanged with the reason. */
export async function renderInDialect(
  standard: string,
  target: DialectTarget,
  options: RenderOptions,
  deps: RenderDeps,
): Promise<RenderResult> {
  const zeroShot = options.exemplars.length === 0;
  const keep = (
    reason: AnswerStyleReason,
    detail?: string,
    factsLock?: FactsLockResult,
  ): RenderResult => ({
    text: standard,
    rendered: 'standard',
    reason,
    detail,
    zeroShot,
    factsLock,
  });
  if (options.mode === 'off') return keep('render_off');
  if (options.mode === 'verified_only' && !options.verified) return keep('not_verified');
  if (!standard.trim()) return keep('error', 'empty standard answer');

  let timer: ReturnType<typeof setTimeout> | undefined;
  let rewrite: string;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new RenderTimeout()), options.timeoutMs);
    });
    const result = await Promise.race([
      deps.generateJson({
        system: renderSystemPrompt(target, options.exemplars),
        prompt: renderUserPrompt(standard),
        schema: renderSchema,
        timeoutMs: options.timeoutMs,
      }),
      timeout,
    ]);
    rewrite = result.text.replace(/\s+/g, ' ').trim();
  } catch (error) {
    return isTimeout(error)
      ? keep('timeout')
      : keep('error', error instanceof Error ? error.message.slice(0, 200) : String(error));
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!rewrite) return keep('error', 'empty rewrite');
  if (nativeScriptCount(rewrite, target.parentLanguage) === 0)
    return keep('error', 'rewrite is not in the native script');
  const roman = newRomanWords(standard, rewrite);
  if (roman.length > 0)
    return keep('error', `rewrite added Roman-script words: ${roman.slice(0, 5).join(' ')}`);
  if (rewrite.length > standard.length * 1.6 + 40)
    return keep('error', 'rewrite is much longer than the answer');

  const factsLock = checkFactsLock(standard, rewrite);
  if (!factsLock.ok) {
    return keep(
      'facts_check_failed',
      `lost ${describeFacts(factsLock.lost)}${factsLock.schemesLost.length ? ` +schemes ${factsLock.schemesLost.join(',')}` : ''}; added ${describeFacts(factsLock.added)}${factsLock.schemesAdded.length ? ` +schemes ${factsLock.schemesAdded.join(',')}` : ''}`,
      factsLock,
    );
  }
  return { text: rewrite, rendered: 'dialect', zeroShot, factsLock };
}

/** Which dialect, if any, the reply may be written in. */
export interface DialectDecision {
  dialectId: string | null;
  /** Set when no dialect applies. */
  reason?: 'no_dialect' | 'low_confidence';
}

/**
 * Policy (2.1): a user-confirmed hint always applies; an identified dialect applies only at
 * 'high' confidence; medium confidence or an abstention with suggestions means low confidence;
 * otherwise there is no dialect. Typed text is only classified when DIALECT_TEXT_DETECT is on, so
 * without a hint it reaches here with no dialect.
 */
export function decideReplyDialect(
  hint: string | undefined,
  identified: {
    dialect?: { id: string; confidence: 'medium' | 'high' } | null;
    dialectCandidates?: unknown[];
  },
): DialectDecision {
  if (hint) return { dialectId: hint };
  if (identified.dialect?.confidence === 'high') return { dialectId: identified.dialect.id };
  if (identified.dialect || (identified.dialectCandidates?.length ?? 0) > 0) {
    return { dialectId: null, reason: 'low_confidence' };
  }
  return { dialectId: null, reason: 'no_dialect' };
}
