import React from 'react';
import { Link } from 'react-router-dom';
import { Car } from 'lucide-react';

// The Driveaway mark: the car-icon tile, lacquered in the current paint.
export default function Logo({ to = '/', sub = 'Ahmedabad', className = '' }) {
  return (
    <Link to={to} className={`group inline-flex items-center gap-2.5 ${className}`} aria-label="Driveaway home">
      {/* The tile tips on hover and gives under a press; the link itself never moves */}
      <span className="lacquer rounded-[10px] w-9 h-9 grid place-items-center shadow-soft transition-transform duration-300 ease-out group-hover:-rotate-6 group-active:scale-[0.96] group-active:duration-150">
        <Car className="w-5 h-5" strokeWidth={2.2} />
      </span>
      <span className="leading-none">
        <span className="block font-wide font-black uppercase tracking-tight text-[17px]">Driveaway</span>
        {sub && <span className="block code-label text-[10px] text-muted mt-0.5">{sub}</span>}
      </span>
    </Link>
  );
}
