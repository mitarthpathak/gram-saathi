import { Mic, Square } from 'lucide-react';
import { useRef, type MouseEvent, type PointerEvent } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';
import { useStrings } from '@/lib/i18n';
import { voiceStrings } from './strings';
import { useRecorder } from './useRecorder';

interface MicButtonProps {
  /** Receives the recording when the user releases the button (or taps it again). */
  onRecorded: (audio: Blob) => void;
  /** True while the previous question is being answered. */
  busy?: boolean;
}

/** Presses shorter than this count as a tap: recording continues until the next tap. */
const TAP_MS = 300;

/**
 * Big push-to-talk button. Hold to speak and release to send, or tap once to start and
 * again to send (easier for some users). Enter / Space toggle it from the keyboard.
 */
export function MicButton({ onRecorded, busy = false }: MicButtonProps) {
  const t = useStrings(voiceStrings);
  const recorder = useRecorder();
  const pressedAt = useRef(0);
  const recording = recorder.status === 'recording';

  const send = async () => onRecorded(await recorder.stop());

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (busy) return;
    // Keep getting pointer events even if the finger slides off the button.
    event.currentTarget.setPointerCapture(event.pointerId);
    if (recording) {
      void send(); // second tap in tap mode
      return;
    }
    pressedAt.current = Date.now();
    void recorder.start();
  };

  const handlePointerUp = () => {
    if (!recording || Date.now() - pressedAt.current < TAP_MS) return;
    void send(); // released after holding
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    // detail === 0 means the click came from the keyboard; pointer clicks are handled above.
    if (event.detail !== 0 || busy) return;
    if (recording) void send();
    else void recorder.start();
  };

  const status = busy ? t.wait : recording ? t.listening : t.holdToSpeak;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        aria-label={t.holdToSpeak}
        aria-pressed={recording}
        disabled={busy}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={recorder.cancel}
        onClick={handleClick}
        onContextMenu={(event) => event.preventDefault()}
        className={cn(
          'relative flex size-24 touch-none items-center justify-center rounded-full text-white shadow-lg transition select-none focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-brand-600',
          busy && 'bg-slate-400',
          !busy && recording && 'scale-110 bg-red-600',
          !busy && !recording && 'bg-brand-700 hover:bg-brand-800 active:scale-95',
        )}
      >
        {recording && (
          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />
        )}
        {busy ? (
          <Spinner />
        ) : recording ? (
          <Square aria-hidden className="size-9 fill-current" />
        ) : (
          <Mic aria-hidden className="size-11" />
        )}
      </button>
      <p aria-live="polite" className="text-base font-semibold text-slate-700">
        {status}
      </p>
    </div>
  );
}
