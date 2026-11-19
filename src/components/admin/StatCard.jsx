import React from 'react';
import CountUp from '../ui/CountUp';

// Neutral stat tile for the admin panel: chroma is reserved for car paints.
// A numeric `value` shows its real figure at once (an admin screen never counts up from zero) and
// only glides when it changes on a refresh (CountUp fromZero={false}: screen readers get the final
// figure, reduced motion swaps it instantly); `format` turns the number into text (e.g. rupees).
export default function StatCard({ title, value, format, icon: Icon, color, subtitle }) {
  const alert = color === 'red' && Number(value) > 0;
  const counts = typeof value === 'number' && Number.isFinite(value);
  return (
    <div className="rounded-chip border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="code-label text-[11px] text-muted">{title}</p>
        {Icon && <Icon className="h-4 w-4 text-muted" aria-hidden="true" />}
      </div>
      <p className={`mt-3 font-wide font-black text-2xl ${alert ? 'text-danger' : ''}`}>
        {counts ? <CountUp value={value} format={format} duration={700} fromZero={false} /> : value}
      </p>
      {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
    </div>
  );
}
