import type Lenis from 'lenis';

let lenis: Lenis | null = null;

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
  if (locked) lenis?.stop();
  else lenis?.start();
  document.documentElement.style.overflow = locked ? 'hidden' : '';
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
