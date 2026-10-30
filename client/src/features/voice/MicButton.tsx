import { Mic, Square } from 'lucide-react';
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
import { cn } from '@/lib/cn';
import { useStrings } from '@/lib/i18n';
import { voiceStrings } from './strings';
import { RecorderError, useRecorder } from './useRecorder';
import { Waveform } from './Waveform';

interface MicButtonProps {
  /** Receives the recording when the user releases the button (or taps it again). */
  onRecorded: (audio: Blob) => void | Promise<void>;
  /** True while the previous question is being answered. */
  busy?: boolean;
}

const TAP_MS = 300;
const MIN_RECORDING_MS = 800;
const MAX_RECORDING_MS = 20_000;
const formatTime = (ms: number) => `0:${String(Math.ceil(ms / 1000)).padStart(2, '0')}`;

/** Hold to speak and release to send, or tap once to start and again to send. */
export function MicButton({ onRecorded, busy = false }: MicButtonProps) {
  const t = useStrings(voiceStrings);
  const toast = useToast();
  const { status, start, stop, cancel, getLevel } = useRecorder();
  const recording = status === 'recording';
  const requesting = status === 'requesting-permission';
  const pressedAt = useRef(0);
  const sending = useRef(false);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const begin = async () => {
    try {
      await start();
      const time = Date.now();
      setStartedAt(time);
      setNow(time);
    } catch (error) {
      const kind = error instanceof RecorderError ? error.kind : 'unavailable';
      const hint = { denied: t.micDenied, insecure: t.micInsecure, unavailable: t.micUnavailable };
      toast.show(hint[kind], 'error');
    }
  };

  const send = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    const duration = Date.now() - startedAt;
    if (duration < MIN_RECORDING_MS) {
      cancel();
      toast.show(t.tooShort, 'error');
      sending.current = false;
      return;
    }
    try {
      const audio = await stop();
      setUploading(true);
      await onRecorded(audio);
    } catch {
      // ChatProvider shows request errors in the conversation.
    } finally {
      setUploading(false);
      sending.current = false;
    }
  }, [cancel, onRecorded, startedAt, stop, toast, t.tooShort]);

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
    if (busy || uploading || requesting) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (recording) {
      void send();
      return;
    }
    pressedAt.current = Date.now();
    void begin();
  };

  const handlePointerUp = () => {
    if (!recording || Date.now() - pressedAt.current < TAP_MS) return;
    void send();
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0 || busy || uploading || requesting) return;
    if (recording) void send();
    else void begin();
  };

  const statusText = requesting
    ? t.requestingPermission
    : recording
      ? t.listening
      : busy
        ? t.thinking
        : uploading
          ? t.uploading
          : speaking
            ? t.speaking
            : t.holdToSpeak;
  const progress = remaining / MAX_RECORDING_MS;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative flex size-24 items-center justify-center">
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          className={cn('absolute size-[5.75rem] -rotate-90', !recording && 'opacity-0')}
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-marigold-100"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeDasharray={2 * Math.PI * 45}
            strokeDashoffset={(1 - progress) * 2 * Math.PI * 45}
            strokeLinecap="round"
            className="text-marigold-600 transition-[stroke-dashoffset] duration-100"
          />
        </svg>
        <button
          type="button"
          aria-label={recording ? t.stopRecording : t.holdToSpeak}
          aria-pressed={recording}
          disabled={busy || uploading || requesting}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={cancel}
          onClick={handleClick}
          onContextMenu={(event) => event.preventDefault()}
          className={cn(
            'relative flex size-[5.25rem] touch-none items-center justify-center rounded-full text-white transition duration-200 select-none focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-brand-600 disabled:cursor-wait',
            (busy || uploading || requesting) && 'bg-slate-300 text-slate-600',
            recording &&
              'scale-105 bg-linear-to-br from-marigold-400 to-marigold-600 shadow-[0_18px_40px_-12px_rgb(221_102_2/0.7)]',
            !recording &&
              !busy &&
              !uploading &&
              !requesting &&
              'animate-breathe bg-linear-to-br from-brand-400 via-brand-600 to-brand-800 hover:scale-105 active:scale-95',
          )}
        >
          {busy || uploading || requesting ? (
            <Spinner />
          ) : recording ? (
            <Square aria-hidden className="size-8 fill-current" />
          ) : (
            <Mic aria-hidden className="size-10" strokeWidth={2.2} />
          )}
        </button>
      </div>
      <div className="flex h-7 items-center justify-center gap-3">
        {recording && (
          <>
            <Waveform getLevel={getLevel} />
            <span className="min-w-10 text-sm font-extrabold text-marigold-700 tabular-nums">
              {formatTime(remaining)}
            </span>
          </>
        )}
        <p aria-live="polite" role="status" className="text-sm font-bold text-slate-600">
          {statusText}
        </p>
      </div>
    </div>
  );
}
