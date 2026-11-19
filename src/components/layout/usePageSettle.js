import { useLayoutEffect, useRef } from 'react';

// A page morph (View Transitions, see hooks/useViewTransitionNavigate.js) already fades the new page
// in, so the settle is skipped while one runs. Browsers that cannot tell simply settle as usual.
const morphing = () => {
  if (typeof document === 'undefined') return false;
  if (document.activeViewTransition) return true;
  try {
    return document.documentElement.matches(':active-view-transition');
  } catch {
    return false;
  }
};

/**
 * Plays the `.page-in` settle (index.css) on `ref`'s element each time `settleKey` changes, without
 * remounting anything: the class comes off, the element is reflowed so the animation restarts, the
 * class goes back on, and it is removed again when the animation ends. Nothing plays on the first
 * render (each page has its own entrance) or during a page morph. Reduced motion collapses the
 * animation in CSS, so the page simply appears.
 */
export default function usePageSettle(ref, settleKey) {
  const last = useRef(settleKey);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || last.current === settleKey) return undefined;
    last.current = settleKey;
    el.classList.remove('page-in');
    if (morphing()) return undefined;
    void el.offsetWidth; // restart from the first frame, even mid-settle
    el.classList.add('page-in');
    const done = (e) => {
      if (e.target === el) el.classList.remove('page-in');
    };
    el.addEventListener('animationend', done);
    el.addEventListener('animationcancel', done);
    return () => {
      el.removeEventListener('animationend', done);
      el.removeEventListener('animationcancel', done);
    };
  }, [ref, settleKey]);
}
