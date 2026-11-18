import React from 'react';

// Neutral stat tile for the admin panel: chroma is reserved for car paints.
export default function StatCard({ title, value, icon: Icon, color, subtitle }) {
  const alert = color === 'red' && Number(value) > 0;
  return (
    <div className="rounded-chip border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="code-label text-[11px] text-muted">{title}</p>
        {Icon && <Icon className="h-4 w-4 text-muted" aria-hidden="true" />}
      </div>
      <p className={`mt-3 font-wide font-black text-2xl ${alert ? 'text-danger' : ''}`}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
    </div>
  );
}
