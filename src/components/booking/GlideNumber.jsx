import React, { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const plain = (n) => Number(n).toLocaleString('en-IN');

/**
 * A fare figure that glides to its new value when the dates, promo or points change. Unlike CountUp
 * it shows its value straight away on mount (nothing counts up from zero on a task screen), and
 * reduced motion swaps the number instantly. Screen readers only ever get the final value.
 */
export default function GlideNumber({ value, format = plain, duration = 420 }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    const from = current.current;
    if (from === target) return undefined;
    if (prefersReducedMotion()) {
      current.current = target;
      setShown(target);
      return undefined;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // Ease-out quart: quick off the mark, settling softly on the new figure
      const n = t < 1 ? Math.round(from + (target - from) * (1 - Math.pow(1 - t, 4))) : target;
      current.current = n;
      setShown(n);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return (
    <>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(target)}</span>
    </>
  );
}
