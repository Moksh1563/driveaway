import { useScroll, useTransform, useReducedMotion } from 'framer-motion';

/**
 * Scroll-linked drift for a large element (a hero photo, a closing headline): returns motion values
 * to pass as `style` on an `m` element. `offset` is Framer's useScroll offset for `ref`; each range
 * maps scroll progress 0 → 1 onto [from, to].
 *
 *   Exit (default offset, element leaving the top):  useScrollDrift(ref, { y: [0, 60] })
 *   Entrance (element arriving from below):          useScrollDrift(ref, { scale: [0.92, 1], offset: ['start end', 'center center'] })
 *
 * With reduced motion every value holds its resting point (the start of an exit, the end of an
 * entrance), so nothing moves.
 */
export default function useScrollDrift(
  ref,
  { y = [0, 0], scale = [1, 1], opacity = [1, 1], offset = ['start start', 'end start'] } = {}
) {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset });
  const entrance = offset[0] !== 'start start';
  const pick = (range) => {
    if (!reduce) return range;
    const rest = entrance ? range[1] : range[0];
    return [rest, rest];
  };
  return {
    y: useTransform(scrollYProgress, [0, 1], pick(y)),
    scale: useTransform(scrollYProgress, [0, 1], pick(scale)),
    opacity: useTransform(scrollYProgress, [0, 1], pick(opacity)),
  };
}
