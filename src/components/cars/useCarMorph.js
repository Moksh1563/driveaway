import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { canViewTransition, carPhotoTransition, whenPresent } from '../../hooks/useViewTransitionNavigate';

// Longest the old page stays frozen while the car page renders (its code is preloaded on card hover)
const MORPH_WAIT_MS = 600;

let morphsRunning = 0;
/**
 * True while a card-to-car-page morph is running. The car page first renders inside it, so it can
 * tell a real morph from a reload or a back/forward visit that still carries the card's hand-over.
 */
export const isCarMorphing = () => morphsRunning > 0;

/**
 * Opens a car from its card: the card's photo glides into the car page's hero (View Transitions),
 * and the car is handed over as router state so the page can show it straight away. Without the
 * API, or with reduced motion, it is an ordinary navigation (still with the hand-over).
 *
 *   const openCar = useCarMorph();
 *   openCar(car, photoElement);
 */
export default function useCarMorph() {
  const navigate = useNavigate();
  return useCallback((car, photo) => {
    const to = `/cars/${car._id}`;
    const options = { state: { car } };
    if (!canViewTransition() || !photo) {
      navigate(to, options);
      return;
    }
    // Only the clicked card's photo takes the shared name, so no other card is captured (a name on
    // every card would leave the rest hanging over the new page while they faded out)
    Object.assign(photo.style, carPhotoTransition(car._id));
    morphsRunning += 1;
    const transition = document.startViewTransition(async () => {
      flushSync(() => navigate(to, options));
      const landed = await whenPresent(`[data-car-photo="${car._id}"]`, MORPH_WAIT_MS);
      if (!landed) {
        // The page was slow to render: change pages without the morph rather than glide to nothing
        transition.skipTransition();
        return;
      }
      // A new page starts at the top (ScrollToTop does the same a moment later); doing it now means
      // the hero is measured where it will rest, not where the scrolled-down page would put it
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    });
    const done = () => { morphsRunning -= 1; };
    transition.finished.then(done, done);
  }, [navigate]);
}
