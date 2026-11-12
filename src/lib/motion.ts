import { useReducedMotion, type Transition } from 'motion/react';

// The three shared animations from the iOS Motion.swift (docs/HANDOFF.md §10).
export const spring: Transition = { type: 'spring', stiffness: 195, damping: 23 };
export const snappy: Transition = { type: 'spring', stiffness: 500, damping: 31 };
export const gentle: Transition = { duration: 0.2, ease: 'easeInOut' };

/** spring / snappy normally; a 0.2 s fade when the user asks for reduced motion. */
export function useMotion() {
  const reduce = useReducedMotion() ?? false;
  return {
    reduce,
    spring: reduce ? gentle : spring,
    snappy: reduce ? gentle : snappy,
    /** Fade + rise 18px, staggered by `delay`. */
    rise: (delay = 0) =>
      reduce
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: gentle }
        : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { ...spring, delay } },
    press: reduce ? {} : { whileTap: { scale: 0.96, opacity: 0.85 }, transition: snappy },
  };
}
