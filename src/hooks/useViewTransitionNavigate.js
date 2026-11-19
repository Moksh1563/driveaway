import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True when the browser can morph between pages (Chrome, Edge, Safari 18+) and motion is allowed. */
export const canViewTransition = () =>
  typeof document !== 'undefined' && typeof document.startViewTransition === 'function' && !prefersReducedMotion();

/**
 * Resolves true once `selector` matches an element, or false after `timeout` ms, so the browser
 * captures the new page only when the element that should morph is on it (a lazy page or a Suspense
 * fallback would otherwise be captured instead). It watches DOM mutations and a timer, not
 * requestAnimationFrame: while a view transition waits for its DOM update the browser renders
 * nothing, so animation frames never arrive (polling with them froze the page until Chrome's ~4s
 * DOM-update timeout). React Router also commits the new route in a React transition, a moment after
 * navigate() returns, so the element is rarely there at once.
 */
export const whenPresent = (selector, timeout) => new Promise((resolve) => {
  if (!selector || document.querySelector(selector)) { resolve(true); return; }
  let timer;
  const observer = new MutationObserver(() => {
    if (!document.querySelector(selector)) return;
    observer.disconnect();
    clearTimeout(timer);
    resolve(true);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  timer = setTimeout(() => { observer.disconnect(); resolve(false); }, timeout);
});

/**
 * navigate(), wrapped in the View Transitions API so elements that share a `view-transition-name`
 * on both pages (see carPhotoTransition) morph from one place to the other. Browsers without the API,
 * and visitors who prefer reduced motion, get an ordinary navigation.
 *
 *   const go = useViewTransitionNavigate();
 *   go(`/cars/${car._id}`, { state: { car }, waitFor: `[data-car-photo="${car._id}"]` });
 *
 * `waitFor` (optional): a selector for the element that must be on the new page before it is
 * captured; the old page stays frozen until then, for at most `waitTimeout` ms (default 600).
 */
export default function useViewTransitionNavigate() {
  const navigate = useNavigate();
  return useCallback((to, options = {}) => {
    const { waitFor, waitTimeout = 600, ...navOptions } = options;
    if (!canViewTransition()) {
      navigate(to, navOptions);
      return;
    }
    document.startViewTransition(async () => {
      flushSync(() => navigate(to, navOptions));
      await whenPresent(waitFor, waitTimeout);
    });
  }, [navigate]);
}

/**
 * The shared name for a car's photo on the fleet/home cards and the car page, so the photo glides
 * between them. Names must be unique on a page: give it only to the one photo per car that morphs.
 */
export const carPhotoTransition = (carId) => (carId ? { viewTransitionName: `car-photo-${carId}` } : undefined);
