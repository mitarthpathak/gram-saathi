import type { DialectOption, DialectResult } from '@gram-saathi/shared';
import { z } from 'zod';
import { env } from '../../config/env';
import { generateJson, type GeminiInputPart } from '../../lib/geminiClient';
import { logger } from '../../lib/logger';
import { getDialectRegistry, STANDARD_DIALECT_LABELS, type DialectRegistryEntry } from './registry';

export type DialectOutcome = {
  dialect: DialectResult | null;
  dialectCandidates?: DialectOption[];
};

export interface DialectEvidence {
  audio?: { data: string; mimeType: string };
  text?: string;
  /** Full set of labels allowed in the structured model response. */
  activeLabels: string[];
  /** Overrides are useful for controlled evaluation; defaults come from env.ts. */
  ensembleSize?: number;
  minimumVotes?: number;
  timeoutMs?: number;
}

export interface DialectDecisionInput {
  votes: string[];
  activeLabels: string[];
  minimumVotes: number;
  /** Number of calls requested, including calls that later failed. */
  ensembleSize: number;
  dialects: DialectRegistryEntry[];
}

/**
 * Pure vote-to-response mapping. Unknown votes are discarded, ties abstain, and candidates are
 * always built from the validated registry rather than model-provided names.
 */
export function decideDialect(input: DialectDecisionInput): DialectOutcome {
  const { activeLabels, dialects } = input;
  const counts = new Map<string, number>();
  for (const vote of input.votes) {
    if (activeLabels.includes(vote)) counts.set(vote, (counts.get(vote) ?? 0) + 1);
  }

  const dialectVotes = rankedDialectEntries(dialects, counts, activeLabels);
  const rankedLabels = activeLabels
    .map((label, order) => ({ label, order, votes: counts.get(label) ?? 0 }))
    .filter(({ votes }) => votes > 0)
    .sort((a, b) => b.votes - a.votes || a.order - b.order);
  const top = rankedLabels[0];
  if (!top) return { dialect: null, dialectCandidates: [] };
  const tiedAtTop = rankedLabels[1]?.votes === top.votes;

  if (top.votes < input.minimumVotes || tiedAtTop || top.label === 'mixed_or_uncertain') {
    return { dialect: null, dialectCandidates: options(dialectVotes.slice(0, 3)) };
  }

  const winningDialect = dialects.find(({ id }) => id === top.label);
  if (winningDialect) {
    const confidence = top.votes === input.ensembleSize ? 'high' : 'medium';
    return {
      dialect: { ...toOption(winningDialect), confidence },
      ...(confidence === 'medium' && {
        dialectCandidates: options(dialectVotes.slice(0, 3)),
      }),
    };
  }

  if (
    top.label === 'hindi' ||
    top.label === 'marathi' ||
    top.label === 'tamil' ||
    top.label === 'english'
  ) {
    return { dialect: null, dialectCandidates: options(dialectVotes.slice(0, 3)) };
  }

  if (top.label === 'gujarati' || top.label === 'punjabi' || top.label === 'other_language') {
    const votedIds = new Set(dialectVotes.map(({ id }) => id));
    const confusable = dialects.filter(
      (entry) =>
        activeLabels.includes(entry.id) &&
        entry.confusableWith.includes(top.label) &&
        !votedIds.has(entry.id),
    );
    return {
      dialect: null,
      dialectCandidates: options([...dialectVotes, ...confusable].slice(0, 3)),
    };
  }

  return { dialect: null, dialectCandidates: options(dialectVotes.slice(0, 3)) };
}

/** The standard labels remain active even when a smaller dialect set is configured. */
export function getActiveDialectLabels(
  configured: string = env.DIALECT_ACTIVE,
  dialects: DialectRegistryEntry[] = getDialectRegistry(),
): string[] {
  const raw = configured.trim().toLowerCase();
  const activeIds =
    raw === 'all'
      ? dialects.map(({ id }) => id)
      : [
          ...new Set(
            raw
              .split(',')
              .map((id) => id.trim())
              .filter(Boolean),
          ),
        ];
  const validIds = new Set(dialects.map(({ id }) => id));
  const unknown = activeIds.filter((id) => !validIds.has(id));
  if (unknown.length > 0) {
    throw new Error('Unknown DIALECT_ACTIVE id(s): ' + unknown.join(', '));
  }
  return [...activeIds, ...STANDARD_DIALECT_LABELS];
}

/** Independent Gemini views: audio, transcript, then both. Text-only requests have one view. */
export async function classifyDialect(input: DialectEvidence): Promise<DialectOutcome> {
  const activeLabels = [...new Set(input.activeLabels)];
  const text = input.text?.trim();
  const views = evidenceViews(input.audio, text).slice(
    0,
    input.ensembleSize ?? env.DIALECT_ENSEMBLE_SIZE,
  );
  if (activeLabels.length === 0 || views.length === 0) {
    return { dialect: null, dialectCandidates: [] };
  }

  const registry = getDialectRegistry();
  const labelSchema = z.enum(activeLabels as [string, ...string[]]);
  const schema = z.object({
    label: labelSchema,
    reason: z.string(),
  });
  const system = buildClassifierPrompt(activeLabels, registry);
  const timeoutMs = input.timeoutMs ?? env.DIALECT_TIMEOUT_MS;

  const results = await Promise.all(
    views.map(async (view) => {
      try {
        const result = await withTimeout(
          generateJson({
            label: 'dialect-' + view.name,
            model: env.GEMINI_AUDIO_MODEL ?? env.GEMINI_CHAT_MODEL,
            system,
            input: view.input,
            schema,
            maxOutputTokens: 256,
            maxRetries: 0,
            timeoutMs,
          }),
          timeoutMs,
        );
        return { label: result.label };
      } catch (error) {
        return { error };
      }
    }),
  );

  const votes: string[] = [];
  for (const result of results) {
    if ('label' in result && typeof result.label === 'string') votes.push(result.label);
  }
  const failures = results.length - votes.length;
  if (failures > 0) {
    logger.warn('dialect classifier: ' + failures + '/' + results.length + ' view(s) failed');
  }
  if (votes.length === 0) return { dialect: null, dialectCandidates: [] };

  const tally = Object.fromEntries(
    [...new Set(votes)].map((label) => [label, votes.filter((vote) => vote === label).length]),
  );
  logger.debug('dialect vote tally', tally);
  return decideDialect({
    votes,
    activeLabels,
    minimumVotes: input.minimumVotes ?? env.DIALECT_MIN_VOTES,
    ensembleSize: views.length,
    dialects: registry,
  });
}

interface EvidenceView {
  name: string;
  input: GeminiInputPart[];
}

function evidenceViews(audio: DialectEvidence['audio'], text: string | undefined): EvidenceView[] {
  if (audio && text) {
    return [
      {
        name: 'audio-only',
        input: [
          { type: 'text', text: 'Classify the spoken variety using the audio only.' },
          audioPart(audio),
        ],
      },
      {
        name: 'transcript-only',
        input: [{ type: 'text', text: 'Classify using only this verbatim transcript:\n' + text }],
      },
      {
        name: 'audio-transcript',
        input: [
          { type: 'text', text: 'Classify using the audio and this verbatim transcript:\n' + text },
          audioPart(audio),
        ],
      },
    ];
  }
  if (audio) {
    return [
      {
        name: 'audio-only',
        input: [
          { type: 'text', text: 'Classify the spoken variety using the audio only.' },
          audioPart(audio),
        ],
      },
    ];
  }
  if (text) {
    return [
      {
        name: 'transcript-only',
        input: [{ type: 'text', text: 'Classify using only this verbatim transcript:\n' + text }],
      },
    ];
  }
  return [];
}

function audioPart(audio: NonNullable<DialectEvidence['audio']>): GeminiInputPart {
  return { type: 'audio', data: audio.data, mimeType: audio.mimeType };
}

function buildClassifierPrompt(activeLabels: string[], dialects: DialectRegistryEntry[]): string {
  const byId = new Map(dialects.map((entry) => [entry.id, entry]));
  const labelDescriptions = activeLabels.map((label) => {
    const entry = byId.get(label);
    if (!entry) return label + ': ' + standardLabelMeaning(label);
    const confusable = entry.confusableWith;
    return (
      entry.id +
      ' (' +
      entry.name +
      ', ' +
      entry.nativeName +
      '); confusableWith: ' +
      (confusable.join(', ') || 'none')
    );
  });
  return [
    'Identify the spoken language or regional variety from the supplied evidence.',
    'Output exactly one label from the closed list below and a short evidence-based reason. Never invent a label.',
    'Choose only from the list. "hindi" means plain standard Hindi with no regional markers.',
    'Prefer "mixed_or_uncertain" over guessing. One word is weak evidence.',
    'Never decide from geography, a person’s name, or an assumed place of origin.',
    'For every confusableWith pair, choose a dialect only when positive language evidence supports that side; absence of evidence for the other side is not enough.',
    'Do not translate, correct, or normalize the evidence.',
    'Active labels:',
    ...labelDescriptions.map((label) => '- ' + label),
  ].join('\n');
}

function standardLabelMeaning(label: string): string {
  const meanings: Record<string, string> = {
    hindi: 'plain standard Hindi with no regional markers',
    marathi: 'standard Marathi',
    tamil: 'standard Tamil',
    english: 'English',
    gujarati: 'Gujarati',
    punjabi: 'Punjabi',
    other_language: 'another language outside the labels',
    mixed_or_uncertain: 'mixed speech or insufficient evidence to decide',
  };
  return meanings[label] ?? 'an active class';
}

function rankedDialectEntries(
  dialects: DialectRegistryEntry[],
  counts: Map<string, number>,
  activeLabels: string[],
): DialectRegistryEntry[] {
  const voteOrder = new Map([...counts.keys()].map((label, index) => [label, index]));
  const activeOrder = new Map(activeLabels.map((label, index) => [label, index]));
  return dialects
    .filter((entry) => counts.has(entry.id))
    .sort(
      (a, b) =>
        (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
        (voteOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (voteOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
        (activeOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (activeOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
}

function options(entries: DialectRegistryEntry[]): DialectOption[] {
  return entries.map(toOption);
}

function toOption(entry: DialectRegistryEntry): DialectOption {
  return { id: entry.id, name: entry.name, nativeName: entry.nativeName };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('dialect classification timed out')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
