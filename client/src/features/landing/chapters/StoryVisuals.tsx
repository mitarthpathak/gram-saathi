import type { QueryResponse } from '@gram-saathi/shared';
import { MapPin, Wheat } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LANGUAGES } from '@/features/language/languages';
import { FeaturePhoneMock } from '@/features/sms/FeaturePhoneMock';
import { SourceCard } from '@/features/sources/SourceCard';
import { SpeakButton } from '@/features/voice/SpeakButton';
import { cn } from '@/lib/cn';
import { format, useStrings } from '@/lib/i18n';
import { chapterStrings } from './strings';

// The side visuals of the story chapter, one per step. They are built from the app's own
// components (source card, feature-phone SMS preview, Listen button) wherever one exists.
// `data-*` hooks are the targets of the scroll-scrubbed animations in StoryScrubber.

/** Step 1: a big live waveform and the four languages it understands. */
export function VoiceVisual({ active }: { active: boolean }) {
  const bars = [0.35, 0.6, 0.9, 0.5, 1, 0.7, 0.4, 0.85, 0.55, 0.95, 0.45, 0.75, 0.3, 0.65, 0.5];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8">
      <div aria-hidden className="flex h-28 items-center gap-2">
        {bars.map((height, index) => (
          <span
            key={index}
            className={cn(
              'h-full w-2.5 rounded-full bg-marigold-400',
              active && 'lively:animate-bar',
            )}
            style={{ transform: `scaleY(${height})`, animationDelay: `${index * 0.07}s` }}
          />
        ))}
      </div>
      <ul className="flex max-w-xs flex-wrap justify-center gap-2.5">
        {LANGUAGES.map((option) => (
          <li
            key={option.code}
            lang={option.code}
            className="rounded-full bg-white px-4 py-2 font-display text-xl leading-[1.3] font-extrabold shadow-soft ring-1 ring-ink/5"
          >
            {option.nativeName}
          </li>
        ))}
      </ul>
    </div>
  );
}

const DOC_SECTIONS = ['docBenefits', 'docEligibility', 'docApply'] as const;
const DOC_REST = [
  '-rotate-6 translate-x-2',
  'rotate-3 -translate-x-3 translate-y-3',
  '-rotate-1 translate-y-6',
];

/** Step 2: pages of the official document fly into a stack; the source chip attaches. */
export function DocsVisual({ response }: { response: QueryResponse | null }) {
  const t = useStrings(chapterStrings);
  const source = response?.sources[0];
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6">
      <div aria-hidden className="relative h-52 w-64">
        {DOC_SECTIONS.map((section, index) => (
          <div key={section} data-doc className="absolute inset-0">
            <div
              className={cn(
                'size-full rounded-2xl bg-white p-4 shadow-lift ring-1 ring-ink/5',
                DOC_REST[index],
              )}
            >
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-marigold-100 text-accent-strong">
                  <Wheat className="size-4" />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[13px] font-extrabold">{t.docTitle}</span>
                  <span className="block text-xs font-semibold text-ink-soft">{t[section]}</span>
                </span>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <span className="h-2 w-full rounded-full bg-paper-deep" />
                <span
                  className={cn(
                    'h-2 rounded-full',
                    index === 2 ? 'w-11/12 bg-marigold-300' : 'w-11/12 bg-paper-deep',
                  )}
                />
                <span className="h-2 w-4/5 rounded-full bg-paper-deep" />
                <span className="h-2 w-2/3 rounded-full bg-paper-deep" />
                <span className="h-2 w-3/4 rounded-full bg-paper-deep" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {source && (
        <div data-source-chip className="w-full max-w-xs">
          <p className="mb-1.5 px-1 text-xs font-extrabold tracking-[0.12em] text-leaf-600 uppercase indic:tracking-normal">
            {t.sourceAttached}
          </p>
          <SourceCard source={source} index={1} />
        </div>
      )}
    </div>
  );
}

/** Step 3: the answer is read aloud, and its SMS copy slides onto a basic phone. */
export function SmsVisual({ response }: { response: QueryResponse | null }) {
  const t = useStrings(chapterStrings);
  if (!response) return null;
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-4">
      <div className="relative">
        <FeaturePhoneMock sms={response.smsText} segments={response.smsSegments} />
        <p
          data-sms-bubble
          aria-hidden
          lang={response.detectedLanguage}
          className="absolute top-[3.6rem] left-5 w-[13rem] rounded-2xl rounded-bl-md bg-white px-3 py-2 text-[13px] leading-snug font-semibold text-ink opacity-0 shadow-lift ring-1 ring-ink/5"
        >
          <span className="line-clamp-3">{response.smsText}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Badge tone="success" className="px-3 py-1 text-sm">
          {format(t.fitsInSms, { count: response.smsSegments })}
        </Badge>
        <SpeakButton text={response.answer} language={response.detectedLanguage} />
      </div>
    </div>
  );
}

/** Step 4: not in the documents, so it points to people who can answer. */
export function CscVisual() {
  const t = useStrings(chapterStrings);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="w-full max-w-xs rounded-[1.75rem] bg-white p-5 shadow-lift ring-1 ring-ink/5">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-leaf-100 text-leaf-600">
          <MapPin aria-hidden className="size-6" />
        </span>
        <p className="mt-3 font-display text-xl leading-tight font-extrabold indic:leading-snug">
          {t.cscTitle}
        </p>
        <p className="mt-1.5 text-[15px] leading-snug text-ink-soft">{t.cscText}</p>
      </div>
    </div>
  );
}
