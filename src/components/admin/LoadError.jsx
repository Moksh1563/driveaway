import React from 'react';
import { RotateCw } from 'lucide-react';
import Button from '../ui/Button';
import { ERROR_IN } from '../booking/FieldError';

/** A failed admin fetch: says so (instead of showing an empty table or zeros) and offers a retry. */
export default function LoadError({ message, onRetry, className = '' }) {
  return (
    // Arrives with a short drop so the failure is noticed (CSS, so it is visible even when the
    // animation chunk failed to load, which is when this tends to show); a new message replays it
    <div
      key={message || ''}
      role="alert"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-chip border border-danger/30 bg-danger/5 p-4 text-sm ${ERROR_IN} ${className}`}
    >
      <p className="font-semibold text-danger">{message || 'Could not load this data.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RotateCw} onClick={onRetry}>Try again</Button>
      )}
    </div>
  );
}
