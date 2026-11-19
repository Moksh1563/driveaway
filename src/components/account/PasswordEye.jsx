import React from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { EASE } from '../../theme/motion';

/**
 * The show/hide password icon. Toggling cross-fades the new eye in where the old one was;
 * nothing moves on first paint.
 */
export default function PasswordEye({ shown }) {
  const Icon = shown ? EyeOff : Eye;
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <m.span
        key={shown ? 'hide' : 'show'}
        className="grid place-items-center"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: 0.18, ease: EASE.out } }}
        exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.1, ease: EASE.in } }}
      >
        <Icon className="h-4 w-4" />
      </m.span>
    </AnimatePresence>
  );
}
