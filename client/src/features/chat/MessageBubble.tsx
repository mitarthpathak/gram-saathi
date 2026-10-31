import type { QueryResponse } from '@gram-saathi/shared';
import { Info, MessageSquareText, Mic, SearchX, TriangleAlert, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { Badge } from '@/components/ui/Badge';
import { SourceList } from '@/features/sources/SourceList';
import { DialectPrompt } from '@/features/dialect/DialectPrompt';
import type { SmsScreenState } from '@/features/sms/navigation';
import { SpeakButton } from '@/features/voice/SpeakButton';
import { voiceNoteFor, type VoiceNote } from '@/features/voice/speak';
import { VoiceNoteLine } from '@/features/voice/VoiceNoteLine';
import { useStrings } from '@/lib/i18n';
import { useDialectInfo } from './dialects';
import { FraudWarning } from './FraudWarning';
import { chatStrings } from './strings';
import type { ChatMessage } from './useChat';

export function MessageBubble({ message }: { message: ChatMessage }) {
  switch (message.role) {
    case 'user':
      return (
        <QuestionBubble
          text={message.text}
          viaVoice={message.via === 'voice'}
          pending={message.pending}
        />
      );
    case 'assistant':
      return (
        <AnswerBubble
          response={message.response}
          viaVoice={message.via === 'voice'}
          autoVoiceNote={message.voiceNote}
        />
      );
    case 'error':
      return (
        <div
          role="alert"
          className="flex animate-fade-up gap-2.5 rounded-2xl bg-red-50 p-4 text-base font-semibold text-red-900 ring-1 ring-red-200"
        >
          <TriangleAlert aria-hidden className="size-6 shrink-0 text-red-600" />
          {message.text}
        </div>
      );
  }
}

function QuestionBubble({
  text,
  viaVoice,
  pending,
}: {
  text: string;
  viaVoice: boolean;
  pending?: boolean;
}) {
  const t = useStrings(chatStrings);
  return (
    <div
      data-voice-transcript={viaVoice ? '' : undefined}
      className="ml-auto w-fit max-w-[85%] animate-fade-up rounded-3xl rounded-br-md bg-linear-to-br from-brand-700 to-brand-900 px-4 py-3 text-lg leading-snug text-white shadow-soft"
    >
      {viaVoice && (
        <p className="mb-1 flex items-center gap-1 text-[13px] font-bold text-brand-100">
          <Mic aria-hidden className="size-3.5" />
          {t.youSaid}
        </p>
      )}
      {pending ? (
        <span aria-hidden className="flex gap-1 py-2">
          {[0, 0.15, 0.3].map((delay) => (
            <span
              key={delay}
              className="size-2 animate-dot rounded-full bg-white"
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
        </span>
      ) : (
        text
      )}
    </div>
  );
}

function AnswerBubble({
  response,
  viaVoice,
  autoVoiceNote,
}: {
  response: QueryResponse;
  viaVoice: boolean;
  autoVoiceNote?: VoiceNote | null;
}) {
  const t = useStrings(chatStrings);
  const smsState: SmsScreenState = { sms: response.smsText, segments: response.smsSegments };
  const scheme = response.sources[0]?.schemeName;
  // Dialect wording is model-generated: label it unless the registry marks the dialect tested.
  const dialectWorded = response.answerStyle?.rendered === 'dialect';
  const dialectId = dialectWorded ? (response.answerStyle?.dialectId ?? null) : null;
  const dialect = useDialectInfo(dialectId);
  const dialectName =
    dialect?.nativeName ?? (response.dialect?.id === dialectId ? response.dialect?.nativeName : '');
  const [listenNote, setListenNote] = useState<VoiceNote | null>(null);
  const voiceNote = listenNote ?? autoVoiceNote ?? null;

  return (
    <article lang={response.detectedLanguage} className="flex animate-fade-up items-start gap-2.5">
      <Logo className="mt-1 size-8 rounded-[0.6rem]" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl rounded-tl-md bg-white p-4 shadow-soft ring-1 ring-brand-950/5">
        {(scheme || response.notFound || response.usedCache) && (
          <div className="flex flex-wrap gap-1.5">
            {scheme && <Badge tone="success">{scheme}</Badge>}
            {response.notFound && (
              <Badge tone="warning">
                <SearchX aria-hidden className="size-3.5" />
                {t.notFound}
              </Badge>
            )}
            {response.usedCache && (
              <Badge tone="accent">
                <Zap aria-hidden className="size-3.5" />
                {t.fromCache}
              </Badge>
            )}
          </div>
        )}
        {viaVoice && <DialectPrompt response={response} />}
        <p className="text-lg leading-relaxed text-slate-800">{response.answer}</p>
        {dialectWorded && dialect?.testStatus !== 'tested' && (
          <p className="-mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-slate-500">
            <Info aria-hidden className="size-3.5 shrink-0" />
            {dialectName ? `${dialectName} · ${t.dialectNote}` : t.dialectNote}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <SpeakButton
            text={response.answer}
            language={response.detectedLanguage}
            audioUrl={response.audioUrl}
            dialectId={dialectId}
            onSpoken={(result) => setListenNote(voiceNoteFor(result, dialectWorded))}
          />
          <Link
            to="/sms"
            state={smsState}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-full bg-cream-100 px-4 text-base font-bold text-slate-700 ring-1 ring-brand-950/10 transition hover:bg-cream-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <MessageSquareText aria-hidden className="size-4" />
            {t.viewSms} · {response.smsSegments}
          </Link>
        </div>
        {voiceNote && <VoiceNoteLine note={voiceNote} language={response.detectedLanguage} />}
        <SourceList sources={response.sources} />
        {(response.notFound || response.sources.length > 0) && (
          <FraudWarning text={response.fraudWarning} />
        )}
      </div>
    </article>
  );
}
