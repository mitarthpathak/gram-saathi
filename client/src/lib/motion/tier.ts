import { createContext, useContext } from 'react';

/**
 * How much motion the page may use, decided once by MotionProvider:
 * - full: desktop with a mouse. Pinned chapters, parallax, smooth scroll, blur.
 * - lite: phones, tablets and low-end devices. No pinning, no blur, fewer parallax layers.
 * - reduced: the OS asks for less motion, or the app's low-bandwidth mode is on. Fades only.
 */
export type MotionTier = 'full' | 'lite' | 'reduced';

export const MotionTierContext = createContext<MotionTier>('lite');

export function useMotionTier(): MotionTier {
  return useContext(MotionTierContext);
}
