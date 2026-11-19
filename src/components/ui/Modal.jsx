import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { m, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { modalMotion, scrimMotion } from '../../theme/motion';
import useFocusTrap from '../../hooks/useFocusTrap';

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/**
 * Dialog shell: scrim, panel, title bar and close button. Focus moves into the panel when it
 * opens, Tab stays inside it, Escape or the scrim closes it, and focus returns to the control
 * that opened it. `initialFocusRef` (optional) picks the element that gets focus first.
 */
export default function Modal({ isOpen, onClose, title, children, size = 'md', initialFocusRef }) {
  const panelRef = useRef(null);
  const titleId = useId();

  useFocusTrap(panelRef, isOpen, { onEscape: onClose, initialFocusRef });

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto p-3 sm:p-6">
          <m.div
            {...scrimMotion}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 bg-[#0C0C0D]/70"
          />
          <div className="flex min-h-full items-center justify-center py-4">
            <m.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              {...modalMotion}
              className={`relative z-10 w-full my-auto ${sizeClasses[size] || sizeClasses.md} bg-surface text-ink border border-line rounded-[22px] shadow-lift max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col focus:outline-none`}
            >
              {title && (
                <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-line flex-shrink-0">
                  <h2 id={titleId} className="font-wide font-black uppercase tracking-tight text-lg">{title}</h2>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="hit-area w-10 h-10 grid place-items-center rounded-full border border-line hover:border-ink transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="overflow-y-auto flex-1 p-6">{children}</div>
            </m.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
