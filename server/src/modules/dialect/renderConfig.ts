import { z } from 'zod';
import renderConfigFile from '../../config/dialect-render.json';

const entrySchema = z.object({
  /** Set to true by a person after native-speaker review; never by code. */
  verified: z.boolean(),
  /** The Gemini TTS language table names this variety itself (not just its parent language). */
  ttsNamedLanguage: z.boolean(),
});
const fileSchema = z.object({ dialects: z.record(z.string(), entrySchema) });

export type DialectRenderEntry = z.infer<typeof entrySchema>;

let parsed: Record<string, DialectRenderEntry> | undefined;

/** server/src/config/dialect-render.json, validated on first use. */
export function getDialectRenderConfig(): Record<string, DialectRenderEntry> {
  parsed ??= fileSchema.parse(renderConfigFile).dialects;
  return parsed;
}

/** Unknown ids count as unverified and not named by TTS. */
export function dialectRenderEntry(id: string): DialectRenderEntry {
  return getDialectRenderConfig()[id] ?? { verified: false, ttsNamedLanguage: false };
}
