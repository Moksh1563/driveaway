import React from 'react';
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
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${variants[variant] || variants.primary} ${sizes[size] || ''} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : Icon ? <Icon className="w-4 h-4" /> : null}
      {children}
    </button>
  );
}
