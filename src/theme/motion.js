// Motion tokens (charles-ux-animation): every Framer animation uses these, and index.css mirrors
// them as --ease-out / --ease-in / --ease-in-out. Appear with ease-out, leave with ease-in on a
// 20–30% shorter duration, move on screen with ease-in-out.
export const EASE = {
  out: [0.32, 0.72, 0, 1],
  in: [0.55, 0, 1, 0.45],
  inOut: [0.77, 0, 0.175, 1],
};

const enter = (duration) => ({ duration, ease: EASE.out });
const leave = (duration) => ({ duration, ease: EASE.in });

/** Modal panel: 220ms in, 160ms out, scaling from 0.97. */
export const modalMotion = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1, transition: enter(0.22) },
  exit: { opacity: 0, scale: 0.97, transition: leave(0.16) },
};

/** Scrim / backdrop paired with a modal (same clock as the panel). */
export const scrimMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: enter(0.22) },
  exit: { opacity: 0, transition: leave(0.16) },
};

/** Dropdown / popover: 160ms in, 120ms out, from its trigger (set transformOrigin on the element). */
export const menuMotion = {
  initial: { opacity: 0, scale: 0.95, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0, transition: enter(0.16) },
  exit: { opacity: 0, scale: 0.95, y: -4, transition: leave(0.12) },
};

/** Bottom sheet: 280ms in, 200ms out, all the way back to its edge. */
export const sheetMotion = {
  initial: { y: '100%' },
  animate: { y: 0, transition: enter(0.28) },
  exit: { y: '100%', transition: leave(0.2) },
};
export const sheetScrimMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: enter(0.28) },
  exit: { opacity: 0, transition: leave(0.2) },
};

/** A panel that opens in place under its trigger (no height animation). */
export const panelMotion = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0, transition: enter(0.22) },
  exit: { opacity: 0, y: -8, transition: leave(0.16) },
};

/** Spring for things that move between places (nav underline). */
export const SPRING = { type: 'spring', duration: 0.35, bounce: 0 };

/** Softer, slower spring for larger surfaces that resize or travel (no overshoot). */
export const SPRING_SOFT = { type: 'spring', duration: 0.55, bounce: 0 };

/**
 * Content arriving into focus: fades up out of a soft blur (headings, hero photos, success states).
 * Spread onto an `m` element: <m.h2 {...focusIn(0.1)} />
 */
export const focusIn = (delay = 0, distance = 16) => ({
  initial: { opacity: 0, y: distance, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, delay, ease: EASE.out } },
});

/**
 * Views that replace each other in one place (booking steps, dashboard tabs). Pass the direction
 * of travel as `custom` (1 forward, -1 back, 0 for a plain cross-fade) on the element and on
 * <AnimatePresence custom={dir} mode="wait" initial={false}>.
 */
export const viewSwap = {
  initial: (dir = 0) => ({ opacity: 0, x: dir * 24 }),
  animate: { opacity: 1, x: 0, transition: enter(0.28) },
  exit: (dir = 0) => ({ opacity: 0, x: dir * -16, transition: leave(0.18) }),
};

/**
 * Items in a list that grows, shrinks or reorders (filtered grids, table rows). Use with the
 * `layout` prop and <AnimatePresence mode="popLayout" initial={false}> so neighbours glide into place.
 */
export const listItem = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1, transition: enter(0.3) },
  exit: { opacity: 0, scale: 0.97, transition: leave(0.18) },
};

/** Layout transition for elements with the `layout` prop (grid reflow, expanding panels). */
export const LAYOUT = { duration: 0.45, ease: EASE.out };
