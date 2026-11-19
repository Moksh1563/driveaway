import React, { useEffect, useRef, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { LAYOUT, listItem } from '../../theme/motion';

const STAGGER = 50; // ms between items on the first showing (capped at the sixth item)
const ENTER = 480; // duration of the `.enter` rise in index.css

/**
 * A list that keeps its items in place as it changes.
 *
 * - First showing (`intro`): items rise in with the CSS `.enter` animation and a short, capped
 *   stagger. It is a CSS animation with fill "backwards", so the items are visible by default and
 *   need no script to show. `introVars` tunes it (`--rise`: how far they travel) and `introDelay`
 *   holds the group back a moment. `onIntroEnd` fires once the arrival has played.
 * - After that: an item that joins or leaves animates with `variants` (default: fade and scale)
 *   while the others glide to their new places. The glide only runs when `signature` changes (the
 *   items, plus whatever changes an item's size), so the page shifting above the list never drags
 *   the items along behind it.
 *
 * Reduced motion: the CSS rise collapses and Framer skips the rest, so changes are instant.
 */
export default function GlideList({
  as: Tag = 'div',
  item = 'div',
  items,
  itemKey,
  signature = itemKey,
  renderItem,
  intro = true,
  introDelay = 0,
  introVars,
  onIntroEnd,
  variants = listItem,
  className = '',
  ...rest
}) {
  const [introOn, setIntroOn] = useState(intro);
  const onEnd = useRef(onIntroEnd);
  useEffect(() => { onEnd.current = onIntroEnd; });

  useEffect(() => {
    if (!introOn) return undefined;
    const t = setTimeout(() => {
      setIntroOn(false);
      onEnd.current?.();
    }, introDelay + 5 * STAGGER + ENTER + 60);
    return () => clearTimeout(t);
  }, [introOn, introDelay]);

  const Item = item === 'li' ? m.li : m.div;
  const layoutDependency = items.map(signature).join('|');

  return (
    <Tag className={`relative ${className}`} {...rest}>
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((entry, i) => (
          <Item
            key={itemKey(entry)}
            layout="position"
            layoutDependency={layoutDependency}
            transition={{ layout: LAYOUT }}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={introOn ? 'enter' : undefined}
            style={introOn ? { '--d': `${introDelay + Math.min(i, 5) * STAGGER}ms`, ...introVars } : undefined}
          >
            {renderItem(entry, i)}
          </Item>
        ))}
      </AnimatePresence>
    </Tag>
  );
}
