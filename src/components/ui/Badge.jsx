import React from 'react';
import { PAINTS } from '../../theme/paints';

const TEXT = {
  Available: 'text-ok', Completed: 'text-ok', Confirmed: 'text-ink', Rented: 'text-muted',
  Maintenance: 'text-warn', Pending: 'text-warn', Cancelled: 'text-danger',
};
const DOT = {
  Available: 'bg-ok', Completed: 'bg-ok', Confirmed: 'bg-ink', Rented: 'bg-muted',
  Maintenance: 'bg-warn', Pending: 'bg-warn', Cancelled: 'bg-danger',
};

/**
 * Status / category tag.
 * - Car categories render as a small paint chip in that category's factory paint.
 * - Statuses render as a dot + label in neutral ink.
 * - onImage: a solid clear-coat pill so it reads over any photo.
 */
export default function Badge({ status, showDot = true, onImage = false, className = '' }) {
  const paint = PAINTS[status];

  if (paint) {
    return (
      <span
        className={`inline-flex items-center rounded-md px-2 py-1 code-label text-[11px] ${className}`}
        style={{ background: paint.hex, color: `rgb(${paint.on})` }}
      >
        {status}
      </span>
    );
  }

  const tone = onImage
    ? 'bg-[#0C0C0D]/80 text-white border border-white/15'
    : `bg-ink/[0.06] ${TEXT[status] || 'text-muted'}`;
  const dot = onImage && status === 'Confirmed' ? 'bg-white' : DOT[status] || 'bg-muted';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 code-label text-[11px] ${tone} ${className}`}>
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      {status}
    </span>
  );
}
