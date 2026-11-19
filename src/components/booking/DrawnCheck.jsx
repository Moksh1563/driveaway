import React from 'react';
import { m } from 'framer-motion';
import { EASE } from '../../theme/motion';

// The stroke is hidden until it starts drawing: a zero-length dash with round caps would show a dot
const draw = (duration, delay) => ({
  initial: { pathLength: 0, opacity: 0 },
  animate: { pathLength: 1, opacity: 1 },
  transition: {
    pathLength: { duration, delay, ease: EASE.out },
    opacity: { duration: 0.01, delay },
  },
});

/**
 * A tick that draws itself in, short stroke first, instead of popping in. With `circle`, a ring
 * draws round it first from twelve o'clock (the checkout's success mark, same shape as lucide's
 * CheckCircle2). Reduced motion shows it finished: Framer animations are skipped globally.
 */
export default function DrawnCheck({ circle = false, delay = 0, className = 'h-4 w-4', strokeWidth = 2 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {circle && (
        <g transform="rotate(-90 12 12)">
          <m.circle cx="12" cy="12" r="10" {...draw(0.5, delay)} />
        </g>
      )}
      <m.path d={circle ? 'm9 12 2 2 4-4' : 'M4 12l5 5L20 6'} {...draw(circle ? 0.26 : 0.3, circle ? delay + 0.34 : delay)} />
    </svg>
  );
}
