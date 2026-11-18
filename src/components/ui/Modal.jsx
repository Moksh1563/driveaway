import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title || undefined}
          className="fixed inset-0 z-[9999] overflow-y-auto p-3 sm:p-6"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0C0C0D]/70"
          />
          <div className="flex min-h-full items-center justify-center py-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className={`relative z-10 w-full my-auto ${sizeClasses[size]} bg-surface text-ink border border-line rounded-[22px] shadow-lift max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col`}
            >
              {title && (
                <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-line flex-shrink-0">
                  <h2 className="font-wide font-black uppercase tracking-tight text-lg">{title}</h2>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="w-9 h-9 grid place-items-center rounded-full border border-line hover:border-ink transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="overflow-y-auto flex-1 p-6">{children}</div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
