import { useEffect, useLayoutEffect, useRef } from 'react';

// Everything a keyboard user can land on with Tab
const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Tabbable elements inside `container`, in DOM order, skipping hidden and inert ones. */
const tabbables = (container) =>
  Array.from(container.querySelectorAll(FOCUSABLE)).filter(
    (el) => el.tabIndex >= 0 && !el.closest('[inert]') && el.getClientRects().length > 0
  );

// Open traps, newest last: only the top one handles keys, so a dialog opened from a dialog
// closes on its own with Escape and keeps Tab to itself.
const stack = [];

// While a dialog that lives outside the app root (a portal on <body>) is open, the page behind it
// is made inert, so screen readers and pointer clicks cannot wander into it. The toast container
// is left alone, so messages shown while a dialog is open are still announced. Counted, so two
// open dialogs do not undo each other.
let inertCount = 0;
const setPageInert = (on) => {
  const root = document.getElementById('root');
  if (!root) return;
  inertCount = Math.max(0, inertCount + (on ? 1 : -1));
  for (const el of root.children) {
    if (el.hasAttribute('data-rht-toaster')) continue;
    if (inertCount > 0) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  }
};

/**
 * Focus management for dialogs and sheets.
 * While `active`: moves focus into `containerRef` (initialFocusRef, else the first tabbable element,
 * else the container itself with tabIndex -1), keeps Tab and Shift+Tab inside it, and calls
 * `onEscape` on Escape. When it deactivates or unmounts, focus goes back to whatever had it before.
 */
export default function useFocusTrap(containerRef, active, { onEscape, initialFocusRef } = {}) {
  // Callers pass inline callbacks; keep the latest in a ref so the trap is not torn down
  // (and focus re-moved) on every render
  const options = useRef({ onEscape, initialFocusRef });
  useLayoutEffect(() => {
    options.current = { onEscape, initialFocusRef };
  });

  useEffect(() => {
    if (!active) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    const previous = document.activeElement;
    const entry = {};
    stack.push(entry);
    const isTop = () => stack[stack.length - 1] === entry;

    const outsideRoot = !container.closest('#root');
    if (outsideRoot) setPageInert(true);

    const focusContainer = () => {
      if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
      container.focus({ preventScroll: true });
    };
    const focusInitial = () => {
      const target = options.current.initialFocusRef?.current || tabbables(container)[0];
      if (target) target.focus({ preventScroll: true });
      else focusContainer();
    };
    if (!container.contains(document.activeElement)) focusInitial();

    const onKeyDown = (e) => {
      if (!isTop()) return;
      if (e.key === 'Escape') {
        if (e.defaultPrevented || !options.current.onEscape) return; // a field inside handled it
        e.preventDefault();
        options.current.onEscape(e);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = tabbables(container);
      if (items.length === 0) {
        e.preventDefault();
        focusContainer();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      const inside = container.contains(current);
      if (e.shiftKey && (!inside || current === first || current === container)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || current === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    // Focus that escapes some other way (a screen reader's cursor, a script) is brought back
    const onFocusIn = (e) => {
      if (isTop() && !container.contains(e.target)) focusInitial();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      const at = stack.indexOf(entry);
      if (at !== -1) stack.splice(at, 1);
      // The page must be interactive again before focus can return to it
      if (outsideRoot) setPageInert(false);
      if (previous && previous !== document.body && previous.isConnected && typeof previous.focus === 'function') {
        previous.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef]);
}
