import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { speak, voiceNoteFor } from '@/features/voice/speak';
import { ApiError, api } from '@/lib/api';
import { useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { chatStrings } from './strings';
import { ChatContext, type ChatMessage, type ChatState } from './useChat';

let lastMessageId = 0;
const nextMessageId = () => `m${++lastMessageId}`;

export function ChatProvider({ children }: { children: ReactNode }) {
  const { language, sessionId, lowBandwidth } = useSettings();
  const t = useStrings(chatStrings);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);

  const errorMessage = useCallback(
    (error: unknown): ChatMessage => ({
      id: nextMessageId(),
      role: 'error',
      text: errorText(error, t),
    }),
    [t],
  );

  const askText = useCallback(
    async (text: string) => {
      setMessages((all) => [...all, { id: nextMessageId(), role: 'user', text, via: 'text' }]);
      setBusy(true);
      try {
        const response = await api.chatQuery({ text, language, sessionId });
        setMessages((all) => [...all, { id: nextMessageId(), role: 'assistant', response }]);
      } catch (error) {
        setMessages((all) => [...all, errorMessage(error)]);
      } finally {
        setBusy(false);
      }
    },
    [language, sessionId, errorMessage],
  );

  const askVoice = useCallback(
    async (audio: Blob) => {
      // Placeholder bubble until the transcript comes back.
      const questionId = nextMessageId();
      setMessages((all) => [
        ...all,
        { id: questionId, role: 'user', text: '', via: 'voice', pending: true },
      ]);
      setBusy(true);
      try {
        const response = await api.voiceQuery({ audio, language, sessionId });
        const answerId = nextMessageId();
        setMessages((all) => [
          ...all.map((message) =>
            message.id === questionId && message.role === 'user'
              ? { ...message, text: response.transcript ?? '', pending: false }
              : message,
          ),
          { id: answerId, role: 'assistant', response },
        ]);
        // Voice in, voice out. Server audio costs data, so low-bandwidth mode uses the phone's voice.
        const dialectWorded = response.answerStyle?.rendered === 'dialect';
        void speak(response.answer, response.detectedLanguage, {
          audioUrl: response.audioUrl,
          dialectId: dialectWorded ? response.answerStyle?.dialectId : null,
          lowBandwidth,
        }).then((result) => {
          const voiceNote = voiceNoteFor(result, dialectWorded);
          if (!voiceNote) return;
          setMessages((all) =>
            all.map((message) =>
              message.id === answerId && message.role === 'assistant'
                ? { ...message, voiceNote }
                : message,
            ),
          );
        });
      } catch (error) {
        setMessages((all) => [
          ...all.filter((message) => message.id !== questionId),
          errorMessage(error),
        ]);
      } finally {
        setBusy(false);
      }
    },
    [language, sessionId, lowBandwidth, errorMessage],
  );

  const lastAnswer = useMemo(() => {
    const last = messages.findLast((message) => message.role === 'assistant');
    return last?.role === 'assistant' ? last.response : null;
  }, [messages]);

  const chat = useMemo<ChatState>(
    () => ({ messages, busy, askText, askVoice, lastAnswer }),
    [messages, busy, askText, askVoice, lastAnswer],
  );

  return <ChatContext value={chat}>{children}</ChatContext>;
}

/** A short, friendly explanation of an API error, in the user's language. */
function errorText(error: unknown, t: (typeof chatStrings)['en']): string {
  if (!(error instanceof ApiError)) return t.errorGeneric;
  if (error.isNetworkError) return t.errorOffline;
  switch (error.code) {
    case 'NO_SPEECH_DETECTED':
      return t.errorNoSpeech;
    case 'RATE_LIMITED':
    case 'AI_RATE_LIMITED':
    case 'AI_UNAVAILABLE':
    case 'AI_TIMEOUT':
    case 'AI_ERROR':
      return t.errorBusy;
    case 'KNOWLEDGE_BASE_MISSING':
    case 'KNOWLEDGE_BASE_UNVERIFIED':
      return t.errorSetup;
    case 'AI_NOT_CONFIGURED':
      return t.errorAiConfig;
  }
  // 413: too long for the server (10 MB) or for the hosting platform's request limit.
  return error.status === 413 ? t.errorTooLong : t.errorGeneric;
}
