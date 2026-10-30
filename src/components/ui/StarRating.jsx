import React from 'react';
import { Star } from 'lucide-react';

export default function StarRating({ value = 0, onChange, size = 'md' }) {
  const sizes = { sm: 'w-3.5 h-3.5', md: 'w-5 h-5', lg: 'w-6 h-6' };
  const isInteractive = typeof onChange === 'function';

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type={isInteractive ? 'button' : 'button'}
          disabled={!isInteractive}
          onClick={() => isInteractive && onChange(star)}
          className={`${isInteractive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
        >
          <Star
            className={`${sizes[size]} ${star <= value ? 'text-amber-400 fill-amber-400' : 'text-gray-600'} transition-colors`}
          />
        </button>
      ))}
    </div>
  );
}
