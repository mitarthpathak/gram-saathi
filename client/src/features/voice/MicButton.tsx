import { Mic, RotateCcw, Square } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/useToast';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useStrings } from '@/lib/i18n';
import { voiceStrings } from './strings';
import { RecorderError, useRecorder } from './useRecorder';
import { Waveform } from './Waveform';

interface MicButtonProps {
  onRecorded: (audio: Blob) => void | Promise<void>;
  onRecordingStart?: () => void;
  busy?: boolean;
  speaking?: boolean;
  disabled?: boolean;
}

const TAP_MS = 300;
const MIN_RECORDING_MS = 800;
const MAX_RECORDING_MS = 20_000;
const CIRCUMFERENCE = 2 * Math.PI * 45;
const formatTime = (ms: number) => `0:${String(Math.ceil(ms / 1000)).padStart(2, '0')}`;

/** Hold to speak and release to send, or tap once to start and again to send. */
export function MicButton({
  onRecorded,
  onRecordingStart,
  busy = false,
  speaking: externalSpeaking = false,
  disabled = false,
}: MicButtonProps) {
  const t = useStrings(voiceStrings);
  const toast = useToast();
  const { status, start, stop, cancel, getLevel } = useRecorder();
  const recording = status === 'recording';
  const requesting = status === 'requesting-permission';
  const recordingStartedAt = useRef(0);
  const pressedAt = useRef(0);
  const sending = useRef(false);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [retryAudio, setRetryAudio] = useState<Blob | null>(null);

  const begin = async () => {
    onRecordingStart?.();
    try {
      await start();
      const time = Date.now();
      recordingStartedAt.current = time;
      setStartedAt(time);
      setNow(time);
      setRetryAudio(null);
    } catch (error) {
      recordingStartedAt.current = 0;
      const kind = error instanceof RecorderError ? error.kind : 'unavailable';
      const hint = { denied: t.micDenied, insecure: t.micInsecure, unavailable: t.micUnavailable };
      toast.show(hint[kind], 'error');
    }
  };

  const sendAudio = useCallback(
    async (audio: Blob) => {
      setUploading(true);
      setThinking(false);
      const thinkingTimer = window.setTimeout(() => setThinking(true), 800);
      try {
        await onRecorded(audio);
        setRetryAudio(null);
      } catch (error) {
        if (error instanceof ApiError && error.code.startsWith('AI_')) setRetryAudio(audio);
      } finally {
        window.clearTimeout(thinkingTimer);
        setUploading(false);
        setThinking(false);
      }
    },
    [onRecorded],
  );

  const send = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    if (!recordingStartedAt.current || Date.now() - recordingStartedAt.current < MIN_RECORDING_MS) {
      recordingStartedAt.current = 0;
      cancel();
      toast.show(t.tooShort, 'error');
      sending.current = false;
      return;
    }
    try {
      recordingStartedAt.current = 0;
      await sendAudio(await stop());
    } catch {
      // Recorder failures are reported by the permission and short-recording messages.
    } finally {
      sending.current = false;
    }
  }, [cancel, sendAudio, stop, toast, t.tooShort]);

  const discardRecording = () => {
    recordingStartedAt.current = 0;
    cancel();
  };

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const timer = window.setInterval(() => {
      const active = synth.speaking;
      setSpeaking((previous) => (previous === active ? previous : active));
    }, 200);
    return () => window.clearInterval(timer);
  }, []);

  const elapsed = recording ? Math.max(0, now - startedAt) : 0;
  const remaining = Math.max(0, MAX_RECORDING_MS - elapsed);

  useEffect(() => {
    if (!recording || remaining > 0) return;
    const timer = window.setTimeout(() => {
      toast.show(t.autoStopped, 'info');
      void send();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [recording, remaining, send, toast, t.autoStopped]);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || requesting || uploading || thinking) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (recording) {
      void send();
      return;
    }
    pressedAt.current = Date.now();
    void begin();
  };

  const handlePointerUp = () => {
    if (
      !recordingStartedAt.current ||
      Date.now() - pressedAt.current < TAP_MS
    ) return;
    void send();
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0 || disabled || requesting || uploading || thinking) return;
    if (recording) void send();
    else void begin();
  };

  const statusText = disabled
    ? t.lowDataTextOnly
    : requesting
    ? t.requestingPermission
    : recording
      ? t.listening
      : uploading
        ? thinking
          ? t.thinking
          : t.uploading
        : busy
          ? t.thinking
          : speaking || externalSpeaking
            ? t.speaking
            : t.holdToSpeak;
  const progress = remaining / MAX_RECORDING_MS;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative flex size-24 items-center justify-center">
        {recording && (
          <>
            <span aria-hidden className="absolute inset-1 animate-ripple rounded-full bg-marigold-300/45" />
            <span aria-hidden className="absolute inset-1 animate-ripple rounded-full bg-marigold-200/40 [animation-delay:700ms]" />
          </>
        )}
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          className={cn('absolute size-[5.75rem] -rotate-90', !recording && 'opacity-0')}
        >
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" className="text-marigold-100" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={(1 - progress) * CIRCUMFERENCE}
            strokeLinecap="round"
            className="text-marigold-600 transition-[stroke-dashoffset] duration-100"
          />
        </svg>
        <button
          type="button"
          aria-label={recording ? t.stopRecording : t.holdToSpeak}
          aria-pressed={recording}
          disabled={disabled || requesting || uploading || thinking}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={discardRecording}
          onClick={handleClick}
          onContextMenu={(event) => event.preventDefault()}
          className={cn(
            'relative flex size-[5.25rem] touch-none items-center justify-center rounded-full text-white transition duration-200 select-none focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-brand-600 disabled:cursor-wait',
            (busy || uploading || thinking || requesting) && 'bg-slate-300 text-slate-600',
            disabled && 'cursor-not-allowed bg-slate-300 text-slate-600 shadow-none',
            recording && 'scale-105 bg-linear-to-br from-marigold-700 to-marigold-900 shadow-lift',
            !disabled && !recording && !busy && !uploading && !requesting && 'animate-breathe bg-linear-to-br from-brand-400 via-brand-600 to-brand-800 hover:scale-105 active:scale-95',
          )}
        >
          {uploading || thinking || requesting || busy ? (
            <Spinner />
          ) : recording ? (
            <Square aria-hidden className="size-8 fill-current" />
          ) : (
            <Mic aria-hidden className="size-10" strokeWidth={2.2} />
          )}
        </button>
      </div>
      <div className="flex min-h-12 items-center justify-center gap-3">
        {recording && (
          <>
            <Waveform getLevel={getLevel} />
            <span className="min-w-10 text-base font-extrabold text-marigold-700 tabular-nums">
              {formatTime(remaining)}
            </span>
          </>
        )}
        <p aria-live="polite" role="status" className="text-base font-bold text-slate-700">
          {statusText}
        </p>
      </div>
      {retryAudio && (
        <button
          type="button"
          onClick={() => void sendAudio(retryAudio)}
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-50 px-5 text-base font-bold text-brand-800 ring-1 ring-brand-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <RotateCcw aria-hidden className="size-4" />
          {t.retry}
        </button>
      )}
    </div>
  );
}
