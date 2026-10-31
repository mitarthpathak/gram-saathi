import { useLayoutEffect, type RefObject } from 'react';

/**
 * Scales a fixed-size design box (`content`, width x height px) to fit inside `slot`, by
 * setting --fit on it before paint. Pure transform: it never moves the layout (no CLS).
 */
export function useFitScale(
  slot: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
  width: number,
  height: number,
  max = 1.15,
): void {
  useLayoutEffect(() => {
    const box = slot.current;
    const inner = content.current;
    if (!box || !inner) return;
    const update = () => {
      const rect = box.getBoundingClientRect();
      const scale = Math.min(max, rect.width / width, rect.height / height);
      inner.style.setProperty('--fit', String(Math.max(0.1, scale)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, [slot, content, width, height, max]);
}
