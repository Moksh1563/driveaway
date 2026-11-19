import React from 'react';
import { RotateCw } from 'lucide-react';
import Button from '../ui/Button';

/** A failed admin fetch: says so (instead of showing an empty table or zeros) and offers a retry. */
export default function LoadError({ message, onRetry, className = '' }) {
  return (
    <div role="alert" className={`flex flex-wrap items-center justify-between gap-3 rounded-chip border border-danger/30 bg-danger/5 p-4 text-sm ${className}`}>
      <p className="font-semibold text-danger">{message || 'Could not load this data.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RotateCw} onClick={onRetry}>Try again</Button>
      )}
    </div>
  );
}
