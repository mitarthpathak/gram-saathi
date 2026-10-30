import type { QueryResponse } from '@gram-saathi/shared';
import { MessageSquareText, Mic, TriangleAlert, Zap } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/Badge';
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
          className="flex gap-2 rounded-2xl bg-red-50 p-4 text-base font-medium text-red-900"
        >
          <TriangleAlert aria-hidden className="size-6 shrink-0" />
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
    <div className="ml-10 rounded-2xl rounded-tr-sm bg-brand-700 p-4 text-lg text-white">
      {viaVoice && (
        <p className="mb-1 flex items-center gap-1 text-sm font-semibold text-brand-100">
          <Mic aria-hidden className="size-4" />
          {t.youSaid}
        </p>
      )}
      {pending ? <span className="animate-pulse tracking-widest">● ● ●</span> : text}
    </div>
  );
}

function AnswerBubble({ response }: { response: QueryResponse }) {
  const t = useStrings(chatStrings);
  const { lowBandwidth } = useSettings();
  const smsState: SmsScreenState = { sms: response.smsText, segments: response.smsSegments };

  return (
    <article
      lang={response.detectedLanguage}
      className="mr-4 flex flex-col gap-3 rounded-2xl rounded-tl-sm bg-white p-4 shadow-sm ring-1 ring-slate-200"
    >
      {(response.notFound || response.usedCache) && (
        <div className="flex flex-wrap gap-2">
          {response.notFound && <Badge tone="warning">{t.notFound}</Badge>}
          {response.usedCache && (
            <Badge tone="success">
              <Zap aria-hidden className="size-3.5" />
              {t.fromCache}
            </Badge>
          )}
        </div>
      )}
      <p className="text-lg leading-relaxed">{response.answer}</p>
      <div className="flex flex-wrap gap-2">
        <SpeakButton
          text={response.answer}
          language={response.detectedLanguage}
          audioUrl={lowBandwidth ? null : response.audioUrl}
        />
        <Link
          to="/sms"
          state={smsState}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 font-semibold text-brand-800 underline-offset-2 hover:underline"
        >
          <MessageSquareText aria-hidden className="size-5" />
          {t.viewSms} ({response.smsSegments})
        </Link>
      </div>
      <SourceList sources={response.sources} />
      <FraudWarning text={response.fraudWarning} />
    </article>
  );
}
