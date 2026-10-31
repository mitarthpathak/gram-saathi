import { Mic, Square } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type Ref,
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
  onRecorded: (audio: Blob) => void;
  /** True while the previous question is being answered. */
  busy?: boolean;
  /** The <button> itself, e.g. to focus it when the app opens from "Hold to speak". */
  buttonRef?: Ref<HTMLButtonElement>;
  /** Draws the eye to the button (a soft marigold halo); it never starts recording. */
  attention?: boolean;
}

/** Presses shorter than this count as a tap: recording continues until the next tap. */
const TAP_MS = 300;
/** Long recordings are sent automatically: answers work best for short questions. */
const MAX_RECORDING_MS = 30_000;

const formatTime = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/**
 * Big push-to-talk button. Hold to speak and release to send, or tap once to start and
 * again to send (easier for some users, and needed while the browser asks for the mic).
 * Enter / Space toggle it from the keyboard.
 */
export function MicButton({
  onRecorded,
  busy = false,
  buttonRef,
  attention = false,
}: MicButtonProps) {
  const t = useStrings(voiceStrings);
  const toast = useToast();
  const { status, start, stop, cancel, getLevel } = useRecorder();
  const recording = status === 'recording';
  const pressedAt = useRef(0);
  const sending = useRef(false);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);

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
    try {
      onRecorded(await stop());
    } catch {
      // Already stopped, e.g. a tap while the recording was being sent.
    } finally {
      sending.current = false;
    }
  }, [stop, onRecorded]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  const elapsed = recording ? Math.max(0, now - startedAt) : 0;

  useEffect(() => {
    if (!recording || elapsed < MAX_RECORDING_MS) return;
    toast.show(t.autoStopped);
    void send();
  }, [recording, elapsed, send, toast, t.autoStopped]);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (busy) return;
    // Keep getting pointer events even if the finger slides off the button.
    event.currentTarget.setPointerCapture(event.pointerId);
    if (recording) {
      void send(); // second tap in tap mode
      return;
    }
    pressedAt.current = Date.now();
    void begin();
  };

  const handlePointerUp = () => {
    if (!recording || Date.now() - pressedAt.current < TAP_MS) return;
    void send(); // released after holding
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    // detail === 0 means the click came from the keyboard; pointer clicks are handled above.
    if (event.detail !== 0 || busy) return;
    if (recording) void send();
    else void begin();
  };

  const statusText = busy ? t.wait : recording ? t.listening : t.holdToSpeak;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative flex size-24 items-center justify-center">
        {recording && (
          <>
            <span
              aria-hidden
              className="absolute inset-1.5 animate-ripple rounded-full bg-marigold-400/45"
            />
            <span
              aria-hidden
              className="absolute inset-1.5 animate-ripple rounded-full bg-marigold-400/35 [animation-delay:0.9s]"
            />
          </>
        )}
        {attention && !recording && !busy && (
          <span
            aria-hidden
            className="absolute inset-0 animate-ripple rounded-full bg-marigold-300/60"
          />
        )}
        <button
          ref={buttonRef}
          type="button"
          aria-label={t.holdToSpeak}
          aria-pressed={recording}
          disabled={busy}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={cancel}
          onClick={handleClick}
          onContextMenu={(event) => event.preventDefault()}
          className={cn(
            'relative flex size-[5.25rem] touch-none items-center justify-center rounded-full text-white transition duration-200 select-none focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-leaf-600',
            busy && 'bg-slate-300 text-slate-600',
            !busy &&
              recording &&
              'scale-105 bg-linear-to-br from-marigold-400 to-marigold-600 shadow-[0_18px_40px_-12px_rgb(221_102_2/0.7)]',
            !busy &&
              !recording &&
              'animate-breathe bg-linear-to-br from-leaf-400 via-leaf-600 to-leaf-600 hover:scale-105 active:scale-95',
          )}
        >
          {busy ? (
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
              {formatTime(elapsed)}
            </span>
          </>
        )}
        <p
          aria-live="polite"
          className={cn('text-sm font-bold text-slate-600', recording && 'sr-only')}
        >
          {statusText}
        </p>
      </div>
    </div>
  );
}
