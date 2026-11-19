import { useCallback, useRef } from 'react';

// A damped side-to-side shake: one firm swing that settles, the way a password field says "no"
const SHAKE = [0, -9, 8, -6, 4, -2, 0].map((x) => ({ transform: `translateX(${x}px)`, easing: 'ease-in-out' }));

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/**
 * Shake for a form whose submit failed: put `ref` on the form and call `shake()` with the error.
 * Runs on the Web Animations API, so it touches only the element's transform (no re-render), and
 * does nothing with reduced motion, where the error message alone carries the news.
 */
export function useShake() {
  const ref = useRef(null);
  const running = useRef(null);
  const shake = useCallback(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function' || prefersReducedMotion()) return;
    running.current?.cancel();
    running.current = el.animate(SHAKE, { duration: 340 });
  }, []);
  return [ref, shake];
}

/**
 * An error message arriving: a quick fade down into place (the CSS class FieldError uses). Add it
 * to the message's className and key the element on the message so a different error replays it.
 * Plain CSS on purpose: the message is visible by default (fill `backwards` only covers the run),
 * so an alert never waits on the lazily loaded Framer chunk, and reduced motion collapses it.
 */
export { ERROR_IN } from '../booking/FieldError';
