import React, { useRef } from 'react';
import { Star } from 'lucide-react';

export default function StarRating({ value = 0, onChange, size = 'md' }) {
  const sizes = { sm: 'w-3.5 h-3.5', md: 'w-5 h-5', lg: 'w-7 h-7' };
  const interactive = typeof onChange === 'function';
  // Only a star the user just picked pops, not the preset rating when the picker first shows
  const picking = useRef(false);
  return (
    <div
      className="flex items-center gap-0.5"
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={interactive ? 'Rating' : `${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const tone = star <= value ? 'fill-current text-ink' : 'text-ink/25';
        if (!interactive) {
          return <span key={star}><Star className={`${sizes[size]} ${tone}`} /></span>;
        }
        // The button stays still; its star swells on hover, gives on press, and the one just picked
        // pops (a new key replays the pop each time the rating changes)
        const picked = star === value;
        const pop = picked && picking.current;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={picked}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            onClick={() => { picking.current = true; onChange(star); }}
            className="group/star p-0.5 rounded"
          >
            <Star
              key={pop ? `picked-${value}` : 'star'}
              className={`${sizes[size]} ${tone} transition-[color,transform] duration-150 ease-out group-hover/star:scale-110 group-active/star:scale-[0.96] ${pop ? 'enter-pop' : ''}`}
            />
          </button>
        );
      })}
    </div>
  );
}
