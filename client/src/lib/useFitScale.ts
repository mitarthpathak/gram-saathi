import { useLayoutEffect, type RefObject } from 'react';

/**
 * Scales a fixed-size design box (`content`, sized in CSS) to fit inside `slot`, by setting
 * --fit on it before paint. Pure transform: it never moves the layout (no CLS). Mark the box
 * with data-fit so the prerender boot script (scripts/prerender.mjs) can do the same before JS.
 */
export function useFitScale(
  slot: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
  max = 1.15,
): void {
  useLayoutEffect(() => {
    const box = slot.current;
    const inner = content.current;
    if (!box || !inner) return;
    const update = () => {
      const rect = box.getBoundingClientRect();
      const scale = Math.min(max, rect.width / inner.offsetWidth, rect.height / inner.offsetHeight);
      inner.style.setProperty('--fit', String(Math.max(0.1, scale)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [slot, content, max]);
}
