import type { QueryResponse } from '@gram-saathi/shared';
import { MessageSquareText, Mic, SearchX, TriangleAlert, Zap } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { Badge } from '@/components/ui/Badge';
import { carryAppState } from '@/features/app-shell/navigation';
import { SourceList } from '@/features/sources/SourceList';
import type { SmsScreenState } from '@/features/sms/navigation';
import { SpeakButton } from '@/features/voice/SpeakButton';
import { useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
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
      return <AnswerBubble response={message.response} />;
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
    <div className="ml-auto w-fit max-w-[85%] animate-fade-up rounded-card rounded-br-md bg-leaf-600 px-4 py-3 text-[17px] leading-snug text-white shadow-leaf">
      {viaVoice && (
        <p className="mb-1 flex items-center gap-1 text-[13px] font-bold text-white/90">
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

function AnswerBubble({ response }: { response: QueryResponse }) {
  const t = useStrings(chatStrings);
  const { lowBandwidth } = useSettings();
  const location = useLocation();
  const smsState: SmsScreenState = {
    ...carryAppState(location.state),
    sms: response.smsText,
    segments: response.smsSegments,
  };
  const scheme = response.sources[0]?.schemeName;

  return (
    <article lang={response.detectedLanguage} className="flex animate-fade-up items-start gap-2.5">
      <Logo className="mt-1 size-8 rounded-[0.6rem]" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-card rounded-tl-md bg-white p-4 shadow-soft ring-1 ring-ink/5">
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
        <p className="text-[17px] leading-relaxed text-ink">{response.answer}</p>
        <div className="flex flex-wrap gap-2">
          <SpeakButton
            text={response.answer}
            language={response.detectedLanguage}
            audioUrl={lowBandwidth ? null : response.audioUrl}
          />
          <Link
            to="/app/sms"
            replace
            state={smsState}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-paper-alt px-3.5 text-sm font-bold text-ink-soft ring-1 ring-ink/10 transition hover:bg-paper-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-leaf-600"
          >
            <MessageSquareText aria-hidden className="size-4" />
            {t.viewSms} · {response.smsSegments}
          </Link>
        </div>
        <SourceList sources={response.sources} />
        <FraudWarning text={response.fraudWarning} />
      </div>
    </article>
  );
}
