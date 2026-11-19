import React from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { EASE } from '../../theme/motion';

/**
 * Cross-fades two icons in one spot (sun/moon, menu/close, sidebar open/close): the old icon turns
 * and fades out while the new one turns in, both in the same grid cell so nothing shifts.
 * `swapKey` names the icon on show; `turn` is the rotation in degrees (0 for a plain fade).
 * With reduced motion Framer skips the animation and the icon swaps at once.
 */
export default function IconSwap({ swapKey, turn = 90, className = '', children }) {
  return (
    <span className={`grid place-items-center ${className}`}>
      <AnimatePresence initial={false}>
        <m.span
          key={swapKey}
          className="col-start-1 row-start-1 grid place-items-center"
          initial={{ opacity: 0, rotate: -turn, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1, transition: { duration: 0.24, ease: EASE.out } }}
          exit={{ opacity: 0, rotate: turn, scale: 0.6, transition: { duration: 0.16, ease: EASE.in } }}
        >
          {children}
        </m.span>
      </AnimatePresence>
    </span>
  );
}
