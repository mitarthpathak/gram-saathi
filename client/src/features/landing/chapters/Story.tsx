import type { LanguageCode } from '@gram-saathi/shared';
import { m } from 'motion/react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { MascotButton } from '../MascotButton';
import type { MascotMood } from '@/components/art/Mascot';
import { PhoneFrame } from '@/components/art/PhoneFrame';
import { reveal } from '@/components/motion/reveal';
import { MessageBubble } from '@/features/chat/MessageBubble';
import { cn } from '@/lib/cn';
import { format, useStrings } from '@/lib/i18n';
import { stagger } from '@/lib/motion/easings';
import { useMotionTier } from '@/lib/motion/tier';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/motion/useMediaQuery';
import { useSettings } from '@/lib/settings';
import { useFitScale } from '@/lib/useFitScale';
import { PhoneScreen, type DemoStage } from '../hero/PhoneScreen';
import { useDemoContent } from '../useDemoContent';
import { Chapter, ChapterHeading } from './Chapter';
import { chapterStrings } from './strings';
import { CscVisual, DocsVisual, SmsVisual, VoiceVisual } from './StoryVisuals';

const StoryScrubber = lazy(() => import('./StoryScrubber'));

const STEPS = [
  { title: 'step1Title', text: 'step1Text', mood: 'listening' },
  { title: 'step2Title', text: 'step2Text', mood: 'thinking' },
  { title: 'step3Title', text: 'step3Text', mood: 'happy' },
  { title: 'step4Title', text: 'step4Text', mood: 'idle' },
] as const satisfies readonly { title: string; text: string; mood: MascotMood }[];

/** The phone's screen for each step. */
const SCREEN: { stage: DemoStage; mic: 'idle' | 'listening' | 'busy' }[] = [
  { stage: 'asking', mic: 'listening' },
  { stage: 'thinking', mic: 'busy' },
  { stage: 'answer', mic: 'idle' },
  { stage: 'answer', mic: 'idle' },
];

/**
 * Chapter 2, "How it works". Desktop (Full tier): the phone stays pinned in the middle while
 * the four steps scroll past, with scrubbed animations. Elsewhere: four stacked cards.
 */
export function Story() {
  const t = useStrings(chapterStrings);
  const tier = useMotionTier();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const pinned = isDesktop && tier === 'full';

  return (
    <Chapter sky="morning" labelledBy="story-title" className="pt-28 pb-16 lg:pt-36">
      <ChapterHeading
        id="story-title"
        eyebrow={t.storyEyebrow}
        title={t.storyTitle}
        className="mx-auto max-w-[92rem] px-5 sm:px-8 lg:px-[6vw] [&_h2]:max-w-3xl"
      />
      {pinned ? <PinnedStory /> : <StackedStory />}
    </Chapter>
  );
}

function useStoryContent() {
  const { language } = useSettings();
  const demo = useDemoContent();
  const demoLanguage: LanguageCode = language === 'en' ? 'hi' : language;
  return {
    demoLanguage,
    answered: demo?.pmKisanExchange(demoLanguage, true) ?? null,
    notFound: demo?.notFoundExchange(demoLanguage) ?? null,
  };
}

function StepText({ index, active }: { index: number; active: boolean }) {
  const t = useStrings(chapterStrings);
  const step = STEPS[index];
  return (
    <div className={cn('transition-opacity duration-500', active ? 'opacity-100' : 'opacity-35')}>
      <p className="flex items-center gap-3 text-sm font-extrabold text-accent-strong">
        <span className="flex size-9 items-center justify-center rounded-full bg-marigold-100 font-display text-base">
          {index + 1}
        </span>
        {format(t.stepLabel, { n: index + 1 })}
      </p>
      <h3 className="mt-4 font-display text-[clamp(1.7rem,2.6vw,2.6rem)] leading-[1.08] font-extrabold tracking-display text-balance indic:leading-[1.3]">
        {t[step.title]}
      </h3>
      <p className="mt-3 max-w-md text-lg leading-relaxed text-ink-soft">{t[step.text]}</p>
    </div>
  );
}

function PinnedStory() {
  const { demoLanguage, answered, notFound } = useStoryContent();
  const [step, setStep] = useState(0);
  const scopeRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  useFitScale(slotRef, phoneRef, 380, 780);

  // The step whose text crosses the middle of the screen is the active one.
  useEffect(() => {
    const blocks = scopeRef.current?.querySelectorAll<HTMLElement>('[data-step]');
    if (!blocks) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setStep(Number(entry.target.getAttribute('data-step')));
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    blocks.forEach((block) => observer.observe(block));
    return () => observer.disconnect();
  }, []);

  const exchange = step === 3 ? notFound : answered;
  const visuals = [
    <VoiceVisual key="voice" active={step === 0} />,
    <DocsVisual key="docs" response={answered?.response ?? null} />,
    <SmsVisual key="sms" response={answered?.response ?? null} />,
    <CscVisual key="csc" />,
  ];

  return (
    <div
      ref={scopeRef}
      className="mx-auto grid max-w-[92rem] grid-cols-[minmax(0,0.8fr)_minmax(0,1.45fr)] gap-8 px-[6vw]"
    >
      <ol>
        {STEPS.map((_, index) => (
          <li key={index} data-step={index} className="flex min-h-[88svh] items-center">
            <StepText index={index} active={step === index} />
          </li>
        ))}
      </ol>

      <div className="sticky top-0 flex h-[100svh] items-center justify-center gap-[3vw]">
        <div
          ref={slotRef}
          className="relative aspect-[380/780] h-[min(40rem,76svh)] shrink-0"
          aria-hidden
        >
          <div
            ref={phoneRef}
            className="absolute top-0 left-0 origin-top-left [scale:var(--fit,0.8)]"
          >
            <div inert>
              <PhoneFrame className="shadow-[30px_50px_80px_-40px_rgb(120_80_30/0.45)]">
                <PhoneScreen
                  stage={SCREEN[step].stage}
                  typedWords={99}
                  exchange={exchange}
                  language={demoLanguage}
                  mic={SCREEN[step].mic}
                />
              </PhoneFrame>
            </div>
          </div>
          <div className="absolute -top-[4.5rem] -left-10 w-24">
            <MascotButton
              mood={STEPS[step].mood}
              bubble="right"
              className="aspect-[120/150] w-full"
            />
          </div>
        </div>

        <div className="relative h-[34rem] w-[min(21rem,25vw)] shrink-0">
          {visuals.map((visual, index) => (
            <div
              key={index}
              aria-hidden={step !== index}
              inert={step !== index}
              className={cn(
                'absolute inset-0 transition-opacity duration-500 ease-out-soft',
                step === index ? 'opacity-100' : 'opacity-0',
              )}
            >
              {visual}
            </div>
          ))}
        </div>
      </div>

      <Suspense>
        <StoryScrubber scope={scopeRef} />
      </Suspense>
    </div>
  );
}

function StackedStory() {
  const tier = useMotionTier();
  const { answered, notFound } = useStoryContent();

  return (
    <ol className="mx-auto mt-12 flex max-w-[92rem] flex-col gap-14 px-5 sm:px-8 lg:px-[6vw]">
      {STEPS.map((_, index) => (
        <m.li
          key={index}
          {...reveal(tier, { delay: stagger })}
          className="grid items-center gap-6 md:grid-cols-2 md:gap-12"
        >
          <StepText index={index} active />
          <div className="relative rounded-[2rem] bg-white/55 p-5 shadow-soft ring-1 ring-ink/5">
            {index === 0 && (
              <div className="flex flex-col gap-4">
                {answered && (
                  <MessageBubble
                    message={{ id: 'q', role: 'user', via: 'voice', text: answered.question }}
                  />
                )}
                <div className="h-56">
                  <VoiceVisual active />
                </div>
              </div>
            )}
            {index === 1 && (
              <div className="h-[26rem]">
                <DocsVisual response={answered?.response ?? null} />
              </div>
            )}
            {index === 2 && <SmsVisual response={answered?.response ?? null} />}
            {index === 3 && (
              <div className="flex flex-col gap-5">
                {notFound && (
                  <MessageBubble
                    message={{ id: 'a', role: 'assistant', response: notFound.response }}
                  />
                )}
                <CscVisual />
              </div>
            )}
          </div>
        </m.li>
      ))}
    </ol>
  );
}
