import React, { useEffect, useRef } from 'react';
import { PAINTS, paintStyle, rupees } from '../../theme/paints';

/**
 * The paint book on the home hero: one lacquer chip per category, standing on the hero's bottom
 * edge. The chosen chip widens to show its category, paint, car count and starting price; the others
 * slim to a strip carrying the paint number (styles in index.css, "Paint picker").
 *
 * A radio group: click or tap a chip, or use the arrow keys / Home / End (selection follows focus).
 * onChoose(type, event) receives the chip button as event.currentTarget, so the hero can start its
 * repaint from that chip.
 */
export default function PaintPicker({ groups, selected, onChoose }) {
  const rowRef = useRef(null);
  const chipRefs = useRef({});
  const types = groups.map((g) => g.type);

  const onKeyDown = (e, index) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let next = null;
    if (step) next = (index + step + types.length) % types.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = types.length - 1;
    if (next === null) return;
    e.preventDefault();
    const chip = chipRefs.current[types[next]];
    chip?.focus({ preventScroll: true });
    onChoose(types[next], { currentTarget: chip });
  };

  // On narrow screens the row scrolls: keep the chosen chip centred once it has finished widening
  useEffect(() => {
    const row = rowRef.current;
    const chip = chipRefs.current[selected];
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return undefined;
    const t = setTimeout(() => {
      const target = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
      row.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }, 320);
    return () => clearTimeout(t);
  }, [selected, groups.length]);

  return (
    <div
      ref={rowRef}
      role="radiogroup"
      aria-label="Choose a category"
      className="paint-picker -mx-4 overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {groups.map((g, i) => {
        const p = PAINTS[g.type];
        const active = g.type === selected;
        const count = g.list?.length || 0;
        const details = count ? `${count} ${count === 1 ? 'car' : 'cars'}, from ${rupees(g.from)} a day` : '';
        return (
          <button
            key={g.type}
            ref={(el) => { chipRefs.current[g.type] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${g.type}, ${p.name}${details ? `, ${details}` : ''}`}
            tabIndex={active ? 0 : -1}
            data-active={active}
            onClick={(e) => onChoose(g.type, e)}
            onKeyDown={(e) => onKeyDown(e, i)}
            style={{ ...paintStyle(g.type), '--d': `${380 + i * 45}ms` }}
            className="paint-chip"
          >
            <span className="paint-chip-surface lacquer">
              {/* Slim: the paint number, plus the category where there is room */}
              <span className="paint-chip-slim" aria-hidden="true">
                <span className="font-wide font-black text-lg leading-none">{p.no}</span>
                <span className="code-label hidden text-[11px] leading-tight md:block [writing-mode:vertical-rl] rotate-180 self-start">
                  {g.type}
                </span>
              </span>
              {/* Open: the whole swatch label */}
              <span className="paint-chip-open" aria-hidden="true">
                <span className="code-label text-[11px]">Paint {p.no}</span>
                <span>
                  <span className="block font-wide font-black uppercase leading-none tracking-tight text-[22px]">{g.type}</span>
                  <span className="mt-1.5 block text-xs">
                    {p.name}{count ? ` · ${count} ${count === 1 ? 'car' : 'cars'}` : ''}
                  </span>
                  {count > 0 && (
                    <span className="mt-0.5 block text-xs opacity-80">from {rupees(g.from)} a day</span>
                  )}
                </span>
              </span>
              <span className="paint-chip-dot" aria-hidden="true" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
