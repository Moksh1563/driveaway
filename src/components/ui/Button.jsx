import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

// Variants map onto the world: ink (default action), paint (the one paint-coloured action), line, ghost, danger.
const variants = {
  primary: 'btn-ink',
  paint: 'btn-paint',
  secondary: 'btn-line',
  dark: 'btn-line',
  ghost: 'btn-ghost',
  danger: 'btn bg-danger text-white hover:brightness-110',
};

const sizes = {
  sm: '!text-xs !px-3.5 !py-2',
  md: '',
  lg: '!text-base !px-7 !py-4',
};

const SPINNER_DELAY = 300; // fast responses never flash a spinner
const SPINNER_HOLD = 500; // once shown, it stays long enough not to flicker

/** Spinner visibility for a `loading` flag: appears after 300ms, then holds at least 500ms. */
function useDelayedSpinner(loading) {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => {
        shownAt.current = performance.now();
        setVisible(true);
      }, SPINNER_DELAY);
      return () => clearTimeout(t);
    }
    if (!visible) return undefined;
    const left = Math.max(0, SPINNER_HOLD - (performance.now() - shownAt.current));
    const t = setTimeout(() => setVisible(false), left);
    return () => clearTimeout(t);
  }, [loading, visible]);

  return visible;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  children,
  className = '',
  rounded, // accepted for backwards compatibility, no longer used
  type = 'button',
  ...props
}) {
  const spinning = useDelayedSpinner(loading);

  return (
    <button
      type={type}
      // Disabled at once on press (no double submits); the spinner itself waits 300ms
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${variants[variant] || variants.primary} ${sizes[size] || ''} ${className}`}
      {...props}
    >
      {/* Label and spinner share one grid cell, so swapping them never changes the button's width */}
      <span className="inline-grid">
        <span
          aria-hidden={spinning || undefined}
          className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 transition-[opacity,transform] duration-150 ease-out ${spinning ? 'scale-90 opacity-0' : 'opacity-100'}`}
        >
          {Icon ? <Icon className="w-4 h-4" /> : null}
          {children}
        </span>
        <span
          aria-hidden="true"
          className={`col-start-1 row-start-1 grid place-items-center transition-[opacity,transform] duration-150 ease-out ${spinning ? 'opacity-100' : 'scale-90 opacity-0'}`}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
        </span>
      </span>
    </button>
  );
}
