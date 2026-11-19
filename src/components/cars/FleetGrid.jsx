import React, { useEffect, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import CarCard from './CarCard';
import { LAYOUT, listItem } from '../../theme/motion';

// Long enough for the first set's capped stagger (5 × 50ms) plus its 480ms rise to finish
const FIRST_ENTRANCE_MS = 900;

/**
 * The fleet's results grid.
 * - The first set rises in as a list (the CSS `.enter` class, so it never waits on JavaScript).
 * - After that, when filters, search, sort or page change, cars that leave fade out of the way,
 *   the ones that stay glide to their new places and new ones settle in (Framer presence + layout).
 *   Cells animate their position only, so a card is never stretched mid-move. The cards are only
 *   measured when the result set (or its order) changes, so typing in the filters or the page
 *   shifting above the grid never re-measures every card or drags them along behind it.
 * - `dimmed` while the next results load, so the grid never blanks.
 */
export default function FleetGrid({ cars, dimmed = false }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), FIRST_ENTRANCE_MS);
    return () => clearTimeout(t);
  }, []);
  const layoutDependency = cars.map((car) => car._id).join('|');

  return (
    <div className={`relative grid grid-cols-1 gap-6 transition-opacity duration-150 ease-out sm:grid-cols-2 xl:grid-cols-3 ${dimmed ? 'opacity-60' : ''}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        {cars.map((car, i) => (
          <m.div
            key={car._id}
            layout="position"
            layoutDependency={layoutDependency}
            transition={{ layout: LAYOUT }}
            variants={listItem}
            initial="initial"
            animate="animate"
            exit="exit"
            className="h-full"
          >
            <div className={settled ? 'h-full' : 'enter h-full'} style={settled ? undefined : { '--d': `${Math.min(i, 5) * 50}ms` }}>
              <CarCard car={car} index={i} />
            </div>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
