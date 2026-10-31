import type { LanguageCode } from '@gram-saathi/shared';
import { BatteryFull, Mic, Signal, Wifi } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';
import { TypingIndicator } from '@/features/chat/ChatWindow';
import { MessageBubble } from '@/features/chat/MessageBubble';
import { SCHEME_SHORTCUTS } from '@/features/chat/schemes';
import { chatStrings } from '@/features/chat/strings';
import { getLanguage } from '@/features/language/languages';
import { cn } from '@/lib/cn';
import { useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { duration, ease } from '@/lib/motion/easings';
import type { DemoExchange } from '../demoContent';

export type DemoStage = 'idle' | 'listening' | 'asking' | 'thinking' | 'answer';

interface PhoneScreenProps {
  stage: DemoStage;
  /** Words of the question shown so far while it "types" in. */
  typedWords: number;
  exchange: DemoExchange | null;
  /** Language of the demo question and answer (the screen's chrome follows the UI). */
  language: LanguageCode;
}

const BARS = [10, 18, 28, 14, 32, 20, 12];

/**
 * The app's home screen at real size (360 px wide), built from the app's own components:
 * welcome card, scheme shortcuts, chat bubbles with sources and the fraud warning.
 */
export function PhoneScreen({ stage, typedWords, exchange, language }: PhoneScreenProps) {
  const t = useStrings(chatStrings);
  const { language: uiLanguage } = useSettings();
  const welcome = stage === 'idle' || stage === 'listening' || !exchange;
  const words = exchange?.question.split(' ') ?? [];

  return (
    <div className="flex h-full flex-col bg-paper text-ink">
      <div className="flex h-12 shrink-0 items-center justify-between px-8 pt-1 text-[15px] font-semibold">
        <span>9:41</span>
        <span className="flex items-center gap-1.5">
          <Signal aria-hidden className="size-4" />
          <Wifi aria-hidden className="size-4" />
          <BatteryFull aria-hidden className="size-5" />
        </span>
      </div>
      <div className="flex shrink-0 items-center justify-between px-5 pt-2 pb-1">
        <Logo className="size-10 rounded-[0.8rem]" />
        <span
          lang={language}
          className="rounded-full bg-white px-3.5 py-1.5 text-[13px] font-bold ring-1 ring-ink/10"
        >
          {getLanguage(language)?.nativeName}
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        <AnimatePresence initial={false}>
          {welcome ? (
            <m.div
              key="welcome"
              className="absolute inset-0 px-5 pt-6"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: duration.base, ease: ease.out }}
            >
              <h2 className="px-1 font-display text-[32px] leading-[1.08] font-extrabold tracking-display text-balance indic:leading-[1.3]">
                {t.emptyTitle}
              </h2>
              <div className="mt-7 grid grid-cols-2 gap-3">
                {SCHEME_SHORTCUTS.slice(0, 2).map(({ id, Icon, tone, name }) => (
                  <div
                    key={id}
                    className="flex h-[9.5rem] flex-col justify-between rounded-[1.5rem] bg-white p-4 shadow-soft ring-1 ring-ink/5"
                  >
                    <span
                      className={cn('flex size-12 items-center justify-center rounded-2xl', tone)}
                    >
                      <Icon aria-hidden className="size-6" />
                    </span>
                    <span className="text-[17px] leading-snug font-bold">{name[uiLanguage]}</span>
                  </div>
                ))}
              </div>
            </m.div>
          ) : (
            <m.div
              key="chat"
              className="absolute inset-0 overflow-hidden [mask-image:linear-gradient(black_88%,transparent)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.base, ease: ease.out }}
            >
              <Conversation stage={stage}>
                <li>
                  <MessageBubble
                    message={{
                      id: 'q',
                      role: 'user',
                      via: 'voice',
                      text: words.slice(0, Math.max(1, typedWords)).join(' '),
                    }}
                  />
                </li>
                {stage === 'thinking' && (
                  <li>
                    <TypingIndicator />
                  </li>
                )}
                {stage === 'answer' && exchange && (
                  <li>
                    <MessageBubble
                      message={{ id: 'a', role: 'assistant', response: exchange.response }}
                    />
                  </li>
                )}
              </Conversation>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <MicArea listening={stage === 'listening'} busy={stage === 'thinking'} />
    </div>
  );
}

/**
 * The chat, top-aligned like the real one. Once the answer has been on screen for a moment,
 * it scrolls up (a transform) to show what was below: sources and the fraud warning.
 */
function Conversation({ stage, children }: { stage: DemoStage; children: ReactNode }) {
  const listRef = useRef<HTMLOListElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const list = listRef.current;
    const frame = list?.parentElement;
    if (!list || !frame || stage !== 'answer') return;
    const measure = () => setOverflow(Math.max(0, list.scrollHeight - frame.clientHeight + 24));
    const timer = window.setTimeout(measure, 50);
    return () => window.clearTimeout(timer);
  }, [stage]);

  const scrolled = stage === 'answer' ? overflow : 0;
  return (
    <ol
      ref={listRef}
      className="flex flex-col gap-3 px-3 pt-2 pb-6 transition-transform delay-[1500ms] duration-[1400ms] ease-in-out-soft"
      style={{ transform: `translateY(${-scrolled}px)` }}
    >
      {children}
    </ol>
  );
}

/** The big push-to-talk button, with live level bars while "listening". */
function MicArea({ listening, busy }: { listening: boolean; busy: boolean }) {
  return (
    <div className="relative flex h-[150px] shrink-0 items-center justify-center gap-4">
      <Bars active={listening} />
      <div className="relative flex size-[7.5rem] items-center justify-center rounded-full bg-leaf-100/80">
        {listening && (
          <>
            <span
              aria-hidden
              className="absolute inset-3 animate-ripple rounded-full bg-marigold-400/45"
            />
            <span
              aria-hidden
              className="absolute inset-3 animate-ripple rounded-full bg-marigold-400/35 [animation-delay:0.9s]"
            />
          </>
        )}
        <span className="relative flex size-24 items-center justify-center rounded-full bg-white shadow-soft">
          <span
            className={cn(
              'flex size-[4.75rem] items-center justify-center rounded-full text-white transition-colors duration-300',
              listening ? 'bg-marigold-500' : busy ? 'bg-leaf-400' : 'bg-leaf-600',
            )}
          >
            <Mic aria-hidden className="size-9" strokeWidth={2.2} />
          </span>
        </span>
      </div>
      <Bars active={listening} mirrored />
    </div>
  );
}

function Bars({ active, mirrored = false }: { active: boolean; mirrored?: boolean }) {
  const heights = mirrored ? [...BARS].reverse() : BARS;
  return (
    <span aria-hidden className="flex h-9 items-center gap-[5px]">
      {heights.map((height, index) => (
        <span
          key={index}
          className={cn(
            'w-[3px] rounded-full transition-colors',
            active ? 'animate-bar bg-marigold-500' : 'scale-y-50 bg-ink-faint/60',
          )}
          style={{ height, animationDelay: `${index * 0.09}s` }}
        />
      ))}
    </span>
  );
}
