import React, { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A real number that counts up to its value the first time it scrolls into view, then follows
 * later changes with a short glide. `format` turns the number into text (default: en-IN grouping).
 * fromZero={false} skips the first count (for figures already on screen at load) and only glides
 * on changes. The final value is always what screen readers get; reduced motion shows it straight away.
 */
export default function CountUp({ value = 0, format = (n) => n.toLocaleString('en-IN'), duration = 900, fromZero = true, className = '', ...rest }) {
  const target = Number(value) || 0;
  const ref = useRef(null);
  const shown = useRef(fromZero ? 0 : target);
  const [display, setDisplay] = useState(() => (prefersReducedMotion() || !fromZero ? target : 0));
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return undefined; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return undefined;
    if (prefersReducedMotion()) { shown.current = target; setDisplay(target); return undefined; }
    const from = shown.current;
    if (from === target) return undefined;
    const span = from === 0 ? duration : Math.min(duration, 450);
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / span);
      const eased = 1 - Math.pow(1 - t, 4);
      const n = Math.round(from + (target - from) * eased);
      shown.current = n;
      setDisplay(n);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration]);

  return (
    <span ref={ref} className={className} {...rest}>
      <span aria-hidden="true">{format(display)}</span>
      <span className="sr-only">{format(target)}</span>
    </span>
  );
}
