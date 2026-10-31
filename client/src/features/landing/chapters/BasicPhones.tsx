import { Signal } from 'lucide-react';
import { animate, m, useMotionValue, useMotionValueEvent } from 'motion/react';
import { useEffect, useRef } from 'react';
import { reveal } from '@/components/motion/reveal';
import { LowBandwidthToggle } from '@/features/sms/LowBandwidthToggle';
import { useStrings } from '@/lib/i18n';
import { duration, ease } from '@/lib/motion/easings';
import { useMotionTier } from '@/lib/motion/tier';
import { useSettings } from '@/lib/settings';
import { MascotButton } from '../MascotButton';
import { useDemoContent } from '../useDemoContent';
import { Chapter, ChapterHeading } from './Chapter';
import { chapterStrings } from './strings';

/** Voice audio estimate: 24 kbps = 3 kB per second, at about 2.2 spoken words per second. */
const AUDIO_KB_PER_SECOND = 3;
const WORDS_PER_SECOND = 2.2;

/**
 * Chapter 6: the real low-data switch (the app-wide setting). Flipping it calms the whole page
 * down live (it is part of the Reduced motion tier) and the data counter drops.
 */
export function BasicPhones() {
  const t = useStrings(chapterStrings);
  const tier = useMotionTier();
  const { language, lowBandwidth } = useSettings();
  const demo = useDemoContent();
  const response = demo?.pmKisanExchange(language).response;

  // Measured: the size of the sample answer as the API sends it. Estimated: its voice audio.
  const textKb = response ? new TextEncoder().encode(JSON.stringify(response)).length / 1024 : 0;
  const words = response ? response.answer.split(/\s+/).length : 0;
  const audioKb = (words / WORDS_PER_SECOND) * AUDIO_KB_PER_SECOND;
  const target = lowBandwidth ? textKb : textKb + audioKb;
  const max = textKb + audioKb || 1;

  return (
    <Chapter sky="morning" labelledBy="basic-title" className="py-24 lg:py-36">
      <div className="mx-auto grid max-w-[92rem] items-center gap-24 px-5 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:px-[6vw]">
        <m.div {...reveal(tier)}>
          <ChapterHeading
            id="basic-title"
            eyebrow={t.basicEyebrow}
            title={t.basicTitle}
            text={t.basicText}
          />
          <div className="mt-7 max-w-lg">
            <LowBandwidthToggle />
          </div>
        </m.div>

        <m.div
          {...reveal(tier, { delay: 0.1 })}
          className="relative rounded-[2rem] bg-white p-7 shadow-lift ring-1 ring-ink/5 sm:p-9"
        >
          <div className="absolute -top-20 right-6 w-20">
            <MascotButton
              mood={lowBandwidth ? 'idle' : 'happy'}
              className="aspect-[120/150] w-full"
            />
          </div>
          <p className="flex items-center gap-2 text-sm font-extrabold tracking-[0.12em] text-ink-soft uppercase indic:tracking-normal">
            <Signal aria-hidden className="size-4 text-leaf-600" />
            {t.dataLabel}
          </p>
          <p className="mt-3 font-display text-[clamp(3.5rem,8vw,6rem)] leading-none font-extrabold tracking-display">
            ≈ <Counter value={target} /> kB
          </p>
          <p className="mt-2 text-lg font-bold text-leaf-600">
            {lowBandwidth ? t.dataTextOnly : t.dataWithVoice}
          </p>
          <div aria-hidden className="mt-6 h-4 overflow-hidden rounded-full bg-paper-deep">
            <div
              className="h-full origin-left rounded-full bg-linear-to-r from-leaf-400 to-marigold-400 transition-transform duration-700 ease-out-soft"
              style={{ transform: `scaleX(${target / max})` }}
            />
          </div>
          <p className="mt-5 text-sm leading-relaxed text-ink-soft">{t.dataNote}</p>
        </m.div>
      </div>
    </Chapter>
  );
}

/** Rolls to `value` (whole kB). A number rolling is not spatial motion, so every tier gets it. */
function Counter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const count = useMotionValue(value);
  useMotionValueEvent(count, 'change', (latest) => {
    if (ref.current) ref.current.textContent = String(Math.max(1, Math.round(latest)));
  });

  useEffect(() => {
    const controls = animate(count, value, { duration: duration.slow * 1.4, ease: ease.out });
    return () => controls.stop();
  }, [count, value]);

  return <span ref={ref}>{Math.max(1, Math.round(value))}</span>;
}
