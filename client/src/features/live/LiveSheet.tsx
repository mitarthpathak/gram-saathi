import { useEffect } from 'react';
import { Mic2, PhoneOff, Radio, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Waveform } from '@/features/voice/Waveform';
import { useStrings } from '@/lib/i18n';
import { liveStrings } from './strings';
import type { LiveError } from './useLiveSession';
import type { LiveStatus } from './liveTypes';

interface LiveSheetProps {
  open: boolean;
  status: LiveStatus;
  error: LiveError | null;
  inputCaption: string;
  outputCaption: string;
  getLevel: () => number;
  onStart: () => void;
  onEnd: () => void;
}

export function LiveSheet({
  open,
  status,
  error,
  inputCaption,
  outputCaption,
  getLevel,
  onStart,
  onEnd,
}: LiveSheetProps) {
  const t = useStrings(liveStrings);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEnd();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onEnd, open]);

  if (!open) return null;

  const statusLabel =
    status === 'connecting'
      ? t.connecting
      : status === 'listening'
        ? t.listening
        : status === 'speaking'
          ? t.speaking
          : status === 'error'
            ? error === 'microphone'
              ? t.micError
              : error === 'network'
                ? t.networkError
                : error === 'ending'
                  ? t.sessionEnding
                  : t.connectionError
            : t.idle;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/55 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-sheet-title"
        className="flex max-h-[100dvh] min-h-[min(42rem,100dvh)] w-full flex-col overflow-hidden rounded-t-[2rem] bg-paper shadow-2xl ring-1 ring-white/70 sm:min-h-[34rem] sm:max-w-lg sm:rounded-[2rem]"
      >
        <header className="flex items-center justify-between border-b border-leaf-900/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-leaf-100 text-leaf-700">
              <Radio aria-hidden className="size-5" />
            </span>
            <div>
              <h2 id="live-sheet-title" className="font-display text-lg font-bold text-ink">
                {t.title}
              </h2>
              <p className="text-sm text-ink-soft" aria-live="polite">
                {statusLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={t.close}
            onClick={onEnd}
            className="flex size-11 items-center justify-center rounded-full text-ink-soft transition hover:bg-leaf-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-700"
          >
            <X aria-hidden className="size-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-6">
          <div className="flex min-h-28 flex-col items-center justify-center gap-4 rounded-card bg-white px-4 py-5 shadow-soft ring-1 ring-leaf-900/5">
            {status === 'connecting' ? (
              <Spinner label={t.connecting} />
            ) : status === 'error' ? (
              <p role="alert" className="max-w-sm text-center font-semibold text-ink">
                {statusLabel}
              </p>
            ) : (
              <>
                <span
                  className={`flex size-16 items-center justify-center rounded-full text-white shadow-leaf ${status === 'speaking' ? 'bg-marigold-500' : 'bg-leaf-600'}`}
                >
                  <Mic2 aria-hidden className="size-7" />
                </span>
                <Waveform getLevel={getLevel} className="h-8 text-marigold-500" />
              </>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-3" aria-live="polite" aria-relevant="text">
            {inputCaption ? (
              <Caption label={t.inputCaption} text={inputCaption} tone="quiet" />
            ) : null}
            {outputCaption ? (
              <Caption label={t.outputCaption} text={outputCaption} tone="answer" />
            ) : null}
            {!inputCaption && !outputCaption && (
              <p className="py-5 text-center text-sm text-ink-soft">{t.noCaption}</p>
            )}
          </div>
        </div>

        <footer className="border-t border-leaf-900/10 bg-white/75 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {status === 'error' ? (
            <Button size="lg" className="w-full" onClick={onStart}>
              <RotateCcw aria-hidden className="size-5" />
              {t.retry}
            </Button>
          ) : (
            <Button size="lg" variant="danger" className="w-full" onClick={onEnd}>
              <PhoneOff aria-hidden className="size-5" />
              {t.end}
            </Button>
          )}
        </footer>
      </section>
    </div>
  );
}

function Caption({ label, text, tone }: { label: string; text: string; tone: 'quiet' | 'answer' }) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 ${tone === 'answer' ? 'bg-leaf-100/80 text-leaf-950' : 'bg-white text-ink ring-1 ring-ink/5'}`}
    >
      <p className="mb-1 text-xs font-bold uppercase tracking-wide opacity-65">{label}</p>
      <p className="text-base leading-relaxed">{text}</p>
    </div>
  );
}
