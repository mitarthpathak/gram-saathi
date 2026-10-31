import { z } from 'zod';

export type Lang = 'hi' | 'mr' | 'ta' | 'en';
export interface Turn {
  role: 'user' | 'assistant';
  text: string;
}
export interface Passage {
  id: string;
  schemeName: string;
  section: string;
  text: string;
  score: number;
}

export const understandSchema = z.object({
  intent: z.enum(['scheme_question', 'smalltalk', 'clarify', 'out_of_scope']),
  language: z.enum(['hi', 'mr', 'ta', 'en']),
  dialect: z.string().nullable(),
  searchQueryEn: z.string(),
  reply: z.string(),
});
export type Understood = z.infer<typeof understandSchema>;

export const answerSchema = z.object({
  answersQuestion: z.boolean(),
  answer: z.string(),
  usedChunkIds: z.array(z.string()),
});
export type Answered = z.infer<typeof answerSchema>;

export interface Deps {
  generateJson: <T>(args: { system: string; prompt: string; schema: z.ZodType<T> }) => Promise<T>;
  search: (queryEn: string) => Promise<Passage[]>;
  minScore: number;
  dialectExamples?: (dialect: string) => string[];
}

export type TurnResult =
  | { kind: 'direct'; intent: 'smalltalk' | 'clarify' | 'out_of_scope'; answer: string; language: Lang; dialect: string | null }
  | { kind: 'grounded'; intent: 'scheme_question'; answer: string; language: Lang; dialect: string | null; usedChunkIds: string[] }
  | { kind: 'notFound'; intent: 'scheme_question' | 'smalltalk' | 'clarify' | 'out_of_scope'; language: Lang; dialect: string | null };

const LANG_NAME: Record<Lang, string> = {
  hi: 'Hindi (Devanagari script)',
  mr: 'Marathi (Devanagari script)',
  ta: 'Tamil (Tamil script)',
  en: 'simple English',
};

const VOICE_STYLE = `
Write the way a friendly local helper SPEAKS to a villager, never like a government notice.
- Short sentences (about 15 words max). Everyday words. Avoid bookish words such as "पात्र", "लाभार्थी", "प्रावधान".
- Use the native script of the language so text-to-speech pronounces it correctly. Never reply in Roman script.
- Keep every number, amount (₹), date, scheme name, URL and helpline EXACTLY as given. Do not round or translate them.
- If a dialect is named, use its everyday words and verb endings. If you are not sure of a dialect word, use the simple standard word instead. Never invent words.`;

function understandSystem(dialectHint?: string, languageHint?: Lang): string {
  return `You are the front door of Gram Saathi, a voice assistant that helps rural Indian citizens (farmers, ASHA workers, panchayat staff) with government schemes.
Read the latest user message together with the recent conversation and decide the intent:
- scheme_question: asks about a scheme, benefit, money, eligibility, documents, how to apply.
- clarify: did not hear or understand your last answer, or asks to repeat/simplify (e.g. "kya keh rahe ho", "samajh nahi aaya", "ki keh raho he").
- smalltalk: greeting, thanks, who are you, what can you do.
- out_of_scope: anything else.
Also return:
- language: hi, mr, ta or en. Typed Roman script (Hinglish, Hindi in English letters) still counts as the spoken language.${languageHint ? ` The selected or detected language is "${languageHint}"; trust that unless the message clearly uses another supported language.` : ''}
- dialect: short lowercase label if clearly recognisable (for example "braj", "wagdi", "marwari", "bhojpuri"), otherwise null.${dialectHint ? ` The user selected the dialect "${dialectHint}"; trust that.` : ''}
- searchQueryEn: for scheme_question only, ONE standalone English search query (resolve words like "it" or "that" from the conversation). Otherwise "".
- reply: for smalltalk, clarify and out_of_scope, the complete reply in the user's language and dialect.
   clarify -> say your previous answer again in simpler, shorter words.
   smalltalk -> one warm sentence, then invite a question about schemes (give one example).
   out_of_scope -> politely say you only help with government schemes, with two example questions.
   scheme_question -> "".
${VOICE_STYLE}`;
}

function answerSystem(lang: Lang, dialect: string | null, examples: string[]): string {
  return `You answer a question about Indian government schemes using ONLY the numbered passages provided.
Reply language: ${LANG_NAME[lang]}${dialect ? `, spoken the ${dialect} way` : ''}.
If the passages do not answer the question, set answersQuestion=false, answer="" and usedChunkIds=[].
Never add a fact, amount, date or eligibility rule that is not in the passages. Report the ids of the passages you used.
${VOICE_STYLE}${examples.length ? `\nHow local speakers phrase things (copy the flavour, not the content):\n${examples.map((e) => `- ${e}`).join('\n')}` : ''}`;
}

export async function handleTurn(
  deps: Deps,
  input: { text: string; history: Turn[]; dialectHint?: string; languageHint?: Lang },
): Promise<TurnResult> {
  const convo = input.history.map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.text}`).join('\n');
  const u = await deps.generateJson({
    system: understandSystem(input.dialectHint, input.languageHint),
    prompt: `Recent conversation:\n${convo || '(none)'}\n\nLatest user message:\n${input.text}`,
    schema: understandSchema,
  });
  const dialect = input.dialectHint ?? u.dialect;

  if (u.intent !== 'scheme_question') {
    if (u.reply.trim()) {
      return { kind: 'direct', intent: u.intent, answer: u.reply.trim(), language: u.language, dialect };
    }
    return { kind: 'notFound', intent: u.intent, language: u.language, dialect };
  }

  const hits = await deps.search(u.searchQueryEn || input.text);
  const passages = hits.filter((hit) => hit.score >= deps.minScore);
  if (passages.length === 0) {
    return { kind: 'notFound', intent: 'scheme_question', language: u.language, dialect };
  }

  const sourceText = passages.map((p) => `[${p.id}] ${p.schemeName} / ${p.section}\n${p.text}`).join('\n\n');
  const a = await deps.generateJson({
    system: answerSystem(u.language, dialect, dialect ? (deps.dialectExamples?.(dialect) ?? []) : []),
    prompt: `Passages:\n${sourceText}\n\nQuestion (English form): ${u.searchQueryEn}\nUser's own words: ${input.text}`,
    schema: answerSchema,
  });

  const known = new Set(passages.map((p) => p.id));
  const used = [...new Set(a.usedChunkIds.filter((id) => known.has(id)))];
  if (!a.answersQuestion || !a.answer.trim() || used.length === 0) {
    return { kind: 'notFound', intent: 'scheme_question', language: u.language, dialect };
  }
  return { kind: 'grounded', intent: 'scheme_question', answer: a.answer.trim(), language: u.language, dialect, usedChunkIds: used };
}

const MAX_TURNS = 6;
const MAX_SESSIONS = 500;
const store = new Map<string, Turn[]>();

export function getHistory(sessionId: string): Turn[] {
  const history = store.get(sessionId);
  if (!history) return [];
  store.delete(sessionId);
  store.set(sessionId, history);
  return history.map((turn) => ({ ...turn }));
}

export function recordTurn(sessionId: string, userText: string, assistantText: string): void {
  const next = [...getHistory(sessionId), { role: 'user' as const, text: userText }, { role: 'assistant' as const, text: assistantText }].slice(-MAX_TURNS);
  store.delete(sessionId);
  store.set(sessionId, next);
  if (store.size > MAX_SESSIONS) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
}

export function clearConversationHistory(): void {
  store.clear();
}
