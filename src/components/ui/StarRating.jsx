import React from 'react';
import { Star } from 'lucide-react';

export default function StarRating({ value = 0, onChange, size = 'md' }) {
  const sizes = { sm: 'w-3.5 h-3.5', md: 'w-5 h-5', lg: 'w-7 h-7' };
  const interactive = typeof onChange === 'function';
  return (
    <div
      className="flex items-center gap-0.5"
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={interactive ? 'Rating' : `${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const icon = <Star className={`${sizes[size]} ${star <= value ? 'fill-current text-ink' : 'text-ink/25'}`} />;
        return interactive ? (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === value}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            onClick={() => onChange(star)}
            className="p-0.5 rounded transition-transform hover:scale-110"
          >
            {icon}
          </button>
        ) : (
          <span key={star}>{icon}</span>
        );
      })}
    </div>
  );
}
