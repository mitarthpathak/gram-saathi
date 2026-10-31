import type { Transition } from 'motion/react';

type Bezier = [number, number, number, number];

/**
 * The whole motion vocabulary: two easings, one spring, three durations (seconds) and one
 * stagger. index.css mirrors the easings as --ease-out-soft / --ease-in-out-soft.
 */
export const ease = {
  /** Things arriving: quick start, long soft landing. */
  out: [0.22, 1, 0.36, 1] as Bezier,
  /** Things moving or looping. */
  inOut: [0.65, 0, 0.35, 1] as Bezier,
};

/** Presses, the dock indicator, the app-sheet morph. */
export const spring: Transition = { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 };

export const duration = { fast: 0.2, base: 0.45, slow: 0.7 };

/** Delay between siblings (lines, cards, chips). */
export const stagger = 0.07;

/** Hover lift + press squish for buttons rendered with `m.*`. */
export const pressable = {
  whileHover: { y: -2 },
  whileTap: { scale: 0.94 },
  transition: spring,
} as const;
