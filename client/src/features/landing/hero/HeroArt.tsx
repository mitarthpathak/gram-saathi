import type { LanguageCode } from '@gram-saathi/shared';
import { BadgeCheck, MessageSquareText } from 'lucide-react';
import {
  m,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react';
import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Birds, Sparkle, Sun, Wheat } from '@/components/art/doodles';
import { PhoneFrame } from '@/components/art/PhoneFrame';
import { cn } from '@/lib/cn';
import { format, useStrings } from '@/lib/i18n';
import { useMotionTier } from '@/lib/motion/tier';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/motion/useMediaQuery';
import { useSettings } from '@/lib/settings';
import { useFitScale } from '@/lib/useFitScale';
import type { DemoExchange } from '../demoContent';
import { MascotButton } from '../MascotButton';
import { landingStrings } from '../strings';
import { PhoneScreen, type DemoStage } from './PhoneScreen';
import { useDemoLoop } from './useDemoLoop';

/** Resting tilt of the phone (degrees). The pointer adds a little on top in the Full tier. */
const TILT = { x: 9, y: -16, z: 10 };

interface HeroArtProps {
  /** Something covers the hero (the intro or the app): hold the demo loop. */
  paused: boolean;
  /** Seconds before the art makes its entrance. */
  delay: number;
  className?: string;
}

/**
 * The right half of the hero: a slim phone tilted in 3D and gently floating, running a live
 * demo of the real app; Saathi waving from its corner; a sun, wheat and two floating chips.
 */
export function HeroArt({ paused, delay, className }: HeroArtProps) {
  const t = useStrings(landingStrings);
  const tier = useMotionTier();
  const { language } = useSettings();
  const slotRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  // The art is composed in a 600 x 720 box (460 wide on phones), then scaled to fit its slot.
  useFitScale(slotRef, boxRef);

  // English visitors see the demo in Hindi: the point is that it speaks their language.
  const demoLanguage: LanguageCode = language === 'en' ? 'hi' : language;
  const [exchange, setExchange] = useState<DemoExchange | null>(null);
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let retryTimer: number | undefined;
    const loadDemo = () => {
      void import('../demoContent')
        .then((module) => {
          if (!cancelled) setExchange(module.pmKisanExchange(demoLanguage, true));
        })
        .catch(() => {
          if (cancelled || attempts >= 2) return;
          attempts++;
          retryTimer = window.setTimeout(loadDemo, attempts * 500);
        });
    };
    loadDemo();
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [demoLanguage]);

  // Start the demo as soon as a small part of the phone enters the viewport. On short screens
  // the phone sits below the copy, so a higher threshold can leave its screen frozen at welcome.
  const inView = useInView(slotRef, { amount: 0.05 });

  // Pointer parallax (Full tier): the phone tilts, chips drift forward, doodles drift back.
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 70, damping: 18 });
  const smoothY = useSpring(pointerY, { stiffness: 70, damping: 18 });
  const rotateY = useTransform(smoothX, (v) => TILT.y + v * 7);
  const rotateX = useTransform(smoothY, (v) => TILT.x - v * 6);
  const frontX = useTransform(smoothX, (v) => v * 16);
  const frontY = useTransform(smoothY, (v) => v * 12);
  const backX = useTransform(smoothX, (v) => v * -10);
  const backY = useTransform(smoothY, (v) => v * -7);

  useEffect(() => {
    if (tier !== 'full') return;
    const onMove = (event: PointerEvent) => {
      pointerX.set((event.clientX / window.innerWidth) * 2 - 1);
      pointerY.set((event.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [tier, pointerX, pointerY]);

  const enter = (extra: number) => ({
    animationDelay: `calc(var(--intro-offset) + ${delay + extra}s)`,
  });
  const sms = exchange?.response.smsText;

  return (
    <div ref={slotRef} className={cn('relative', className)}>
      <p className="sr-only">{t.demoAlt}</p>
      <div
        ref={boxRef}
        data-fit
        className="absolute top-1/2 left-1/2 h-[720px] w-[460px] [transform:translate(-50%,-50%)_scale(var(--fit,0.8))] lg:w-[600px]"
      >
        {/* Back layer: sun, birds, wheat. */}
        <m.div aria-hidden className="absolute inset-0" style={{ x: backX, y: backY }}>
          <div
            className="absolute top-[70px] left-0 w-[96px] animate-pop lg:top-[118px] lg:left-[70px] lg:w-[118px]"
            style={enter(0.35)}
          >
            <Sun className="w-full" />
          </div>
          <div
            className="absolute top-[30px] left-[120px] w-[58px] animate-fade-up lg:top-[64px] lg:left-[196px]"
            style={enter(0.6)}
          >
            <Birds className="w-full" />
          </div>
          <div
            className="absolute top-[260px] left-[-34px] h-[330px] w-[170px] origin-bottom animate-fade-up lg:top-[250px] lg:left-[18px] lg:h-[350px] lg:w-[180px]"
            style={enter(0.45)}
          >
            <Wheat className="size-full" />
          </div>
        </m.div>

        {/* Soft shadow on the "ground". */}
        <div
          aria-hidden
          className="absolute top-[655px] left-[90px] h-[46px] w-[300px] rounded-[50%] bg-[rgb(201_150_96/0.32)] blur-2xl lg:left-[150px] lg:w-[330px]"
        />

        {/* The phone. */}
        <DemoPhone
          paused={paused}
          inView={inView}
          exchange={exchange}
          language={demoLanguage}
          isDesktop={isDesktop}
          rotateX={rotateX}
          rotateY={rotateY}
          style={enter(0.15)}
        />

        {/* Saathi, sitting on the phone's top corner. */}
        <div
          className="absolute top-[-22px] left-[296px] w-[108px] animate-pop lg:top-[-52px] lg:left-[418px] lg:w-[118px]"
          style={enter(0.75)}
        >
          <MascotButton mood="wave" className="aspect-[120/150] w-full" />
        </div>

        {/* Front layer: floating SMS bubbles and the source chip. */}
        <m.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ x: frontX, y: frontY }}
        >
          <div
            className="absolute top-[330px] left-[300px] animate-pop lg:top-[352px] lg:left-[462px]"
            style={enter(0.95)}
          >
            <span className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-[17px] font-bold shadow-lift ring-1 ring-ink/5 lively:animate-[float_5s_var(--ease-in-out-soft)_infinite_-1s] max-lg:px-5 max-lg:py-3 max-lg:text-[24px]">
              <MessageSquareText className="size-5 text-leaf-600 max-lg:size-7" />
              {t.smsLabel}
            </span>
          </div>
          {sms && (
            <div
              className="absolute top-[414px] left-[150px] w-[300px] animate-fade-up lg:top-[428px] lg:left-[338px] lg:w-[248px]"
              style={enter(1.05)}
            >
              <p
                lang={demoLanguage}
                className="rounded-2xl rounded-tl-md bg-white px-4 py-2.5 text-[14px] leading-snug font-semibold text-ink shadow-lift ring-1 ring-ink/5 lively:animate-[float_6s_var(--ease-in-out-soft)_infinite_-3s] max-lg:text-[20px]"
              >
                {/* Clamp an inner span: on the padded box the third line would peek out. */}
                <span className="line-clamp-2">{sms}</span>
              </p>
            </div>
          )}
          <div
            className="absolute top-[528px] left-[92px] animate-pop lg:top-[518px] lg:left-[372px]"
            style={enter(1.15)}
          >
            <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[15px] font-semibold whitespace-nowrap text-ink shadow-lift ring-1 ring-ink/5 lively:animate-[float_7s_var(--ease-in-out-soft)_infinite_-2s] max-lg:text-[18px]">
              <BadgeCheck className="size-5 text-leaf-600 max-lg:size-7" />
              {format(t.sourceChip, { scheme: 'PM-KISAN' })}
            </span>
          </div>
          <Sparkle className="absolute top-[640px] left-[420px] w-6 lg:left-[560px] text-marigold-300 lively:animate-twinkle" />
          <Sparkle className="absolute top-[200px] left-[430px] w-4 lg:left-[540px] text-marigold-300 lively:animate-twinkle [animation-delay:-1.2s]" />
        </m.div>
      </div>
    </div>
  );
}

interface DemoPhoneProps {
  paused: boolean;
  inView: boolean;
  exchange: DemoExchange | null;
  language: LanguageCode;
  isDesktop: boolean;
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  style: CSSProperties;
}

/** Keep the per-word demo updates inside the phone instead of rerendering all of HeroArt. */
const DemoPhone = memo(function DemoPhone({
  paused,
  inView,
  exchange,
  language,
  isDesktop,
  rotateX,
  rotateY,
  style,
}: DemoPhoneProps) {
  const tier = useMotionTier();
  const playing = !paused && inView && tier !== 'reduced' && exchange !== null;
  const { stage, typedWords } = useDemoLoop(playing, exchange?.question.split(' ').length ?? 0);
  // Reduced-motion users still get the complete phone preview, held on its final screen.
  const visibleStage: DemoStage = tier === 'reduced' && exchange ? 'answer' : stage;

  return (
    <div
      aria-hidden
      className="absolute top-[360px] left-[226px] animate-fade-up lg:left-[320px]"
      style={style}
    >
      <div className="lively:animate-float">
        <m.div
          inert
          style={{
            rotateX: tier === 'reduced' ? TILT.x : rotateX,
            rotateY: tier === 'reduced' ? TILT.y : rotateY,
            rotateZ: TILT.z,
            scale: isDesktop ? 0.79 : 0.74,
            transformPerspective: 1900,
            x: '-50%',
            y: '-50%',
          }}
        >
          <PhoneFrame depth className="shadow-[40px_60px_80px_-40px_rgb(120_80_30/0.45)]">
            <PhoneScreen
              stage={visibleStage}
              typedWords={typedWords}
              exchange={exchange}
              language={language}
            />
          </PhoneFrame>
        </m.div>
      </div>
    </div>
  );
});
