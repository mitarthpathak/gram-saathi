import type { RefObject } from 'react';
import { gsap, useGSAP } from '@/lib/motion/gsap';

/**
 * Scroll-scrubbed parts of the story chapter (Full motion tier only, loaded lazily with GSAP).
 * useGSAP reverts everything on unmount, so StrictMode's double mount is safe.
 */
export default function StoryScrubber({ scope }: { scope: RefObject<HTMLElement | null> }) {
  useGSAP(
    () => {
      const select = gsap.utils.selector(scope);
      const [, searchStep, answerStep] = select('[data-step]');
      if (!searchStep || !answerStep) return;

      // Pages of the official document fly in and land in a stack.
      gsap.fromTo(
        select('[data-doc]'),
        {
          x: (index: number) => 320 - index * 40,
          y: (index: number) => -220 + index * 140,
          rotate: (index: number) => 24 - index * 18,
          opacity: 0,
        },
        {
          x: 0,
          y: 0,
          rotate: 0,
          opacity: 1,
          ease: 'none',
          stagger: 0.18,
          scrollTrigger: { trigger: searchStep, start: 'top 85%', end: 'center 55%', scrub: 0.6 },
        },
      );
      // Then the source chip snaps on.
      gsap.fromTo(
        select('[data-source-chip]'),
        { y: 36, scale: 0.92, opacity: 0 },
        {
          y: 0,
          scale: 1,
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: searchStep,
            start: 'center 62%',
            end: 'center 42%',
            scrub: 0.6,
          },
        },
      );
      // The SMS bubble slides off the smartphone onto the basic phone's screen, and fades in it.
      gsap
        .timeline({
          scrollTrigger: { trigger: answerStep, start: 'top 80%', end: 'center 45%', scrub: 0.6 },
        })
        .fromTo(
          select('[data-sms-bubble]'),
          { x: -340, y: 60, rotate: -10, opacity: 1 },
          { x: 0, y: 0, rotate: 0, ease: 'none', duration: 0.75 },
        )
        .to(select('[data-sms-bubble]'), { opacity: 0, ease: 'none', duration: 0.25 });
    },
    { scope },
  );
  return null;
}
