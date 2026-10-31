import { useCallback, useEffect, useRef, useState } from 'react';
import { config } from '@/lib/config';
import { createPlaceholderAudio } from './placeholderAudio';

export type RecorderStatus = 'idle' | 'requesting-permission' | 'recording';

/** Why recording could not start: shown to the user as a hint. */
export type RecorderErrorKind = 'denied' | 'unavailable' | 'insecure';

export class RecorderError extends Error {
  readonly kind: RecorderErrorKind;

  constructor(kind: RecorderErrorKind, message: string) {
    super(message);
    this.name = 'RecorderError';
    this.kind = kind;
  }
}

export interface Recorder {
  status: RecorderStatus;
  /** Asks for the microphone (first time only) and starts recording. Throws RecorderError. */
  start: () => Promise<void>;
  /** Stops recording and resolves with the recorded audio. */
  stop: () => Promise<Blob>;
  /** Stops recording and throws the audio away. */
  cancel: () => void;
  /** Input level from 0 to 1, for a live waveform. Cheap: call it every animation frame. */
  getLevel: () => number;
}

/** Opus in WebM where supported (Chrome, Firefox, Android), MP4/AAC on Safari. */
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'];

interface Session {
  startedAt: number;
  chunks: Blob[];
  recorder?: MediaRecorder;
  stream?: MediaStream;
  context?: AudioContext;
  analyser?: AnalyserNode;
}

/**
 * Microphone recording for the push-to-talk button (getUserMedia + MediaRecorder). The mic only
 * works on https or localhost. In browser-mock mode a device without a mic records a silent
 * placeholder instead, so the demo still runs end to end.
 */
export function useRecorder(): Recorder {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const session = useRef<Session | null>(null);
  const requesting = useRef(false);
  const samples = useRef<Uint8Array<ArrayBuffer> | null>(null);

  /** Turns the mic off (the browser's recording indicator goes away). */
  const release = useCallback(() => {
    const current = session.current;
    session.current = null;
    current?.stream?.getTracks().forEach((track) => track.stop());
    current?.context?.close().catch(() => undefined);
  }, []);

  useEffect(() => release, [release]);

  const start = useCallback(async () => {
    if (session.current || requesting.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      if (config.useMocks) {
        session.current = { startedAt: Date.now(), chunks: [] };
        setStatus('recording');
        return;
      }
      throw new RecorderError(
        window.isSecureContext ? 'unavailable' : 'insecure',
        'This browser cannot record audio here',
      );
    }

    let stream: MediaStream;
    if (!window.isSecureContext) {
      throw new RecorderError('insecure', 'Microphone access needs a secure connection');
    }
    requesting.current = true;
    setStatus('requesting-permission');
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      const denied = name === 'NotAllowedError' || name === 'SecurityError';
      setStatus('idle');
      throw new RecorderError(
        !window.isSecureContext ? 'insecure' : denied ? 'denied' : 'unavailable',
        String(error),
      );
    } finally {
      requesting.current = false;
    }

    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      setStatus('idle');
      throw new RecorderError('unavailable', String(error));
    }
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    // The level meter is a nice-to-have: recording works without it.
    let context: AudioContext | undefined;
    let analyser: AnalyserNode | undefined;
    try {
      context = new AudioContext();
      analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
    } catch {
      analyser = undefined;
    }

    try {
      recorder.start();
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      context?.close().catch(() => undefined);
      setStatus('idle');
      throw new RecorderError('unavailable', String(error));
    }
    session.current = { startedAt: Date.now(), chunks, recorder, stream, context, analyser };
    setStatus('recording');
  }, []);

  const stop = useCallback(async (): Promise<Blob> => {
    const current = session.current;
    setStatus('idle');
    if (!current) throw new RecorderError('unavailable', 'Not recording');
    const { recorder } = current;
    if (!recorder) {
      session.current = null;
      return createPlaceholderAudio(Date.now() - current.startedAt);
    }
    try {
      return await new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () =>
          resolve(new Blob(current.chunks, { type: recorder.mimeType || 'audio/webm' }));
        recorder.onerror = (event) => reject(event.error);
        recorder.stop();
      });
    } finally {
      release();
    }
  }, [release]);

  const cancel = useCallback(() => {
    const recorder = session.current?.recorder;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    release();
    setStatus('idle');
  }, [release]);

  const getLevel = useCallback(() => {
    const current = session.current;
    if (!current) return 0;
    const { analyser } = current;
    // No analyser (mock recording): a gentle fake level keeps the waveform alive.
    if (!analyser) return 0.25 + Math.random() * 0.3;
    if (samples.current?.length !== analyser.fftSize) {
      samples.current = new Uint8Array(analyser.fftSize);
    }
    const data = samples.current;
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const value of data) {
      const sample = (value - 128) / 128;
      sum += sample * sample;
    }
    return Math.min(1, Math.sqrt(sum / data.length) * 5);
  }, []);

  return { status, start, stop, cancel, getLevel };
}
