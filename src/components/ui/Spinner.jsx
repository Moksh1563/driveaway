import React from 'react';

export default function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-11 h-11' };
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${sizes[size]} rounded-full border-2 border-ink/15 border-t-ink animate-spin`} />
    </div>
  );
}
