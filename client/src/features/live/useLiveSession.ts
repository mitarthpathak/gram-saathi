import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/useToast';
import { useStrings } from '@/lib/i18n';
import { api } from '@/lib/api';
import { config } from '@/lib/config';
import { useSettings } from '@/lib/settings';
import { FakeLiveClient } from './FakeLiveClient';
import { chatToolRequest, LiveClient, requestLiveToken } from './LiveClient';
import type { LiveStatus } from './liveTypes';
import type { LiveEvent } from './liveProtocol';
import { liveStrings } from './strings';

export type LiveError = 'microphone' | 'network' | 'connection' | 'ending' | 'tool';

export function useLiveSession() {
  const { language, dialectHint, sessionId, lowBandwidth } = useSettings();
  const t = useStrings(liveStrings);
  const toast = useToast();
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [error, setError] = useState<LiveError | null>(null);
  const [inputCaption, setInputCaption] = useState('');
  const [outputCaption, setOutputCaption] = useState('');
  const clientRef = useRef<LiveClient | FakeLiveClient | null>(null);
  const endTimer = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (endTimer.current !== null) window.clearTimeout(endTimer.current);
    endTimer.current = null;
    clientRef.current?.close();
    clientRef.current = null;
    setStatus('idle');
  }, []);

  const reportEvent = useCallback((event: LiveEvent) => {
    if (event.type === 'inputTranscription') setInputCaption(event.text);
    if (event.type === 'outputTranscription') {
      setOutputCaption(event.text);
      setStatus('speaking');
    }
    if (event.type === 'audio') setStatus('speaking');
    if (event.type === 'interrupted') setStatus('listening');
    if (event.type === 'goAway') {
      if (endTimer.current !== null) window.clearTimeout(endTimer.current);
      endTimer.current = null;
      setError('ending');
      setStatus('error');
      clientRef.current?.close();
      clientRef.current = null;
    }
    if (event.type === 'error') {
      if (endTimer.current !== null) window.clearTimeout(endTimer.current);
      endTimer.current = null;
      setError('connection');
      setStatus('error');
      clientRef.current?.close();
      clientRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (lowBandwidth) return;
    stop();
    setError(null);
    setInputCaption('');
    setOutputCaption('');
    setStatus('connecting');
    const request = {
      sessionId,
      language,
      ...(dialectHint ? { dialectHint } : {}),
    };

    try {
      const token = config.useMocks ? null : await requestLiveToken(request);
      if (config.useMocks || token?.mock) {
        const fake = new FakeLiveClient({
          onEvent: reportEvent,
          onPlaybackEnded: () => setStatus('listening'),
          onSpeaking: () => setStatus('speaking'),
          onListening: () => setStatus('listening'),
        });
        clientRef.current = fake;
        fake.start({ input: t.mockInput, output: t.mockOutput });
      } else if (token) {
        const client = new LiveClient({
          onEvent: reportEvent,
          onPlaybackEnded: () => setStatus('listening'),
          onToolQuestion: async (question) => {
            try {
              return await chatToolRequest(question, request, api.chatQuery);
            } catch {
              setError('tool');
              toast.show(t.toolError, 'error');
              return { answer: t.toolError, fraudWarning: '' };
            }
          },
        });
        clientRef.current = client;
        await client.prepareAudio();
        await client.connect(token);
        client.startMicrophone();
        setStatus('listening');
      }
      endTimer.current = window.setTimeout(
        () => {
          setError('ending');
          setStatus('error');
          clientRef.current?.close();
          clientRef.current = null;
          toast.show(t.sessionEnding, 'info');
        },
        10 * 60 * 1000,
      );
    } catch (cause) {
      if (endTimer.current !== null) window.clearTimeout(endTimer.current);
      endTimer.current = null;
      clientRef.current?.close();
      clientRef.current = null;
      const errorKey: LiveError =
        cause instanceof DOMException &&
        (cause.name === 'NotAllowedError' ||
          cause.name === 'NotFoundError' ||
          cause.name === 'NotReadableError')
          ? 'microphone'
          : cause instanceof Error && cause.message === 'Live token request failed'
            ? 'network'
            : 'connection';
      setError(errorKey);
      setStatus('error');
      const message =
        errorKey === 'microphone'
          ? t.micError
          : errorKey === 'network'
            ? t.networkError
            : t.connectionError;
      toast.show(message, 'error');
    }
  }, [dialectHint, language, lowBandwidth, reportEvent, sessionId, stop, t, toast]);

  useEffect(
    () => () => {
      if (endTimer.current !== null) window.clearTimeout(endTimer.current);
      clientRef.current?.close();
    },
    [],
  );

  const getLevel = useCallback(() => clientRef.current?.getLevel() ?? 0, []);

  return { status, error, inputCaption, outputCaption, getLevel, start, stop, lowBandwidth };
}
