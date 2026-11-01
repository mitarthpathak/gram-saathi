import type Lenis from 'lenis';

let lenis: Lenis | null = null;
let lockedScrollY = 0;
let savedPageStyles:
  | {
      htmlOverflow: string;
      bodyOverflow: string;
      bodyPosition: string;
      bodyTop: string;
      bodyLeft: string;
      bodyRight: string;
      bodyWidth: string;
    }
  | undefined;

/**
 * Starts Lenis smooth scrolling, driven by GSAP's ticker so ScrollTrigger stays in sync.
 * Desktop / Full tier only: touch devices keep native scrolling. Resolves with a cleanup.
 */
export async function startSmoothScroll(): Promise<() => void> {
  const [{ default: LenisClass }, { gsap, ScrollTrigger }] = await Promise.all([
    import('lenis'),
    import('./gsap'),
  ]);
  const instance = new LenisClass({ lerp: 0.12 });
  const unsubscribe = instance.on('scroll', () => ScrollTrigger.update());
  const tick = (time: number) => instance.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  lenis = instance;

  return () => {
    unsubscribe();
    gsap.ticker.remove(tick);
    instance.destroy();
    if (lenis === instance) lenis = null;
  };
}

/** Freezes page scrolling under a modal (smooth scroll stops; native scroll is locked by CSS). */
export function setScrollLocked(locked: boolean): void {
  const html = document.documentElement;
  const body = document.body;

  if (locked) {
    lenis?.stop();
    if (savedPageStyles) return;

    lockedScrollY = window.scrollY;
    savedPageStyles = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
    };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${lockedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    return;
  }

  if (savedPageStyles) {
    html.style.overflow = savedPageStyles.htmlOverflow;
    body.style.overflow = savedPageStyles.bodyOverflow;
    body.style.position = savedPageStyles.bodyPosition;
    body.style.top = savedPageStyles.bodyTop;
    body.style.left = savedPageStyles.bodyLeft;
    body.style.right = savedPageStyles.bodyRight;
    body.style.width = savedPageStyles.bodyWidth;
    savedPageStyles = undefined;
    window.scrollTo(0, lockedScrollY);
  }
  lenis?.start();
}

/** Scrolls to an element, selector or offset: smoothly with Lenis, natively otherwise. */
export function scrollToTarget(target: string | HTMLElement | number, smooth = true): void {
  if (lenis) {
    lenis.scrollTo(target, { immediate: !smooth, duration: 1.1 });
    return;
  }
  const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto';
  if (typeof target === 'number') {
    window.scrollTo({ top: target, behavior });
    return;
  }
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  element?.scrollIntoView({ behavior, block: 'start' });
}
