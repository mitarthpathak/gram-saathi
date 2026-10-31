import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { speak } from '@/features/voice/speak';
import { useDemo } from '@/features/demo/useDemo';
import { fallbackDemoSample, findDemoSample } from '@/features/demo/demoData';
import { ApiError, api } from '@/lib/api';
import { useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { chatStrings } from './strings';
import { ChatContext, type ChatMessage, type ChatState } from './useChat';

let lastMessageId = 0;
const nextMessageId = () => `m${++lastMessageId}`;

export function ChatProvider({ children }: { children: ReactNode }) {
  const { language, languageHint, dialectHint, sessionId, lowBandwidth } = useSettings();
  const { enabled: demoMode } = useDemo();
  const t = useStrings(chatStrings);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const voiceController = useRef<AbortController | null>(null);

  useEffect(() => () => voiceController.current?.abort(), []);

  const cancelVoiceRequest = useCallback(() => {
    const controller = voiceController.current;
    if (!controller) return;
    controller.abort();
    voiceController.current = null;
    setBusy(false);
  }, []);

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
        setMessages((all) => [
          ...all,
          { id: nextMessageId(), role: 'assistant', response, via: 'text' },
        ]);
      } catch (error) {
        if (demoMode) {
          const fallback = fallbackDemoSample(language);
          setMessages((all) => [
            ...all,
            { id: nextMessageId(), role: 'error', text: t.demoFallback },
            { id: nextMessageId(), role: 'user', text: fallback.question, via: 'text' },
            { id: nextMessageId(), role: 'assistant', response: fallback.response, via: 'text' },
          ]);
        } else setMessages((all) => [...all, errorMessage(error)]);
      } finally {
        setBusy(false);
      }
    },
    [language, sessionId, errorMessage, demoMode, t.demoFallback],
  );

  const askVoice = useCallback(
    async (audio: Blob) => {
      voiceController.current?.abort();
      const controller = new AbortController();
      voiceController.current = controller;
      // Placeholder bubble until the transcript comes back.
      const questionId = nextMessageId();
      setMessages((all) => [
        ...all,
        { id: questionId, role: 'user', text: '', via: 'voice', pending: true },
      ]);
      setBusy(true);
      try {
        const response = await api.voiceQuery({
          audio,
          sessionId,
          ...(languageHint ? { language: languageHint } : {}),
          ...(dialectHint ? { dialectHint } : {}),
          signal: controller.signal,
        });
        setMessages((all) => [
          ...all.map((message) =>
            message.id === questionId && message.role === 'user'
              ? { ...message, text: response.transcript ?? '', pending: false }
              : message,
          ),
          { id: nextMessageId(), role: 'assistant', response, via: 'voice' },
        ]);
        // Voice in, voice out. Server audio costs data, so low-bandwidth mode uses the phone's voice.
        speak(
          response.answer,
          response.detectedLanguage,
          lowBandwidth ? null : response.audioUrl,
          setSpeaking,
        );
      } catch (error) {
        setMessages((all) => {
          const withoutQuestion = all.filter((message) => message.id !== questionId);
          if (controller.signal.aborted) return withoutQuestion;
          if (demoMode) {
            const fallback = fallbackDemoSample(languageHint ?? language);
            return [
              ...withoutQuestion,
              { id: nextMessageId(), role: 'error', text: t.demoFallback },
              {
                id: questionId,
                role: 'user',
                text: fallback.transcript,
                via: 'voice',
                pending: false,
              },
              { id: nextMessageId(), role: 'assistant', response: fallback.response, via: 'voice' },
            ];
          }
          return [...withoutQuestion, errorMessage(error)];
        });
        if (!demoMode && error instanceof ApiError && error.code.startsWith('AI_')) throw error;
      } finally {
        if (voiceController.current === controller) {
          voiceController.current = null;
          setBusy(false);
        }
      }
    },
    [
      language,
      languageHint,
      dialectHint,
      sessionId,
      lowBandwidth,
      errorMessage,
      demoMode,
      t.demoFallback,
    ],
  );

  const askDemo = useCallback((sampleId: string) => {
    const item = findDemoSample(sampleId);
    if (!item) return;
    setMessages((all) => [
      ...all,
      { id: nextMessageId(), role: 'user', text: item.transcript, via: 'voice' },
      { id: nextMessageId(), role: 'assistant', response: item.response, via: 'voice' },
    ]);
    setBusy(false);
  }, []);

  const lastAnswer = useMemo(() => {
    const last = messages.findLast((message) => message.role === 'assistant');
    return last?.role === 'assistant' ? last.response : null;
  }, [messages]);

  const chat = useMemo<ChatState>(
    () => ({
      messages,
      busy,
      speaking,
      askText,
      askVoice,
      askDemo,
      cancelVoiceRequest,
      lastAnswer,
    }),
    [messages, busy, speaking, askText, askVoice, askDemo, cancelVoiceRequest, lastAnswer],
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
