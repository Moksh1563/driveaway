import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Where each history entry was last scrolled to, by location key (lives for the tab's session)
const positions = new Map();

/**
 * ScrollToTop Component
 * - A new page (link click, redirect) starts at the top.
 * - Back and Forward return to where that page was scrolled, once its content is tall enough.
 * - In-page state written to the URL with `replace` (fleet filters, sort, page) does not jump.
 * - A #fragment change on the same page (the skip link) is left to the browser.
 */
export default function ScrollToTop() {
  const { pathname, search, hash, key } = useLocation();
  const navigationType = useNavigationType();
  const last = useRef(null); // { pathname, url } of the previous run

  // We restore Back/Forward positions ourselves, so the browser should not try first
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);

  // Remember this entry's scroll position as the user scrolls. Scroll events that arrive after the
  // history has already moved on (the old page shrinking away) are not this entry's.
  useEffect(() => {
    const save = () => {
      if ((window.history.state?.key || 'default') === key) positions.set(key, window.scrollY);
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [key]);

  useEffect(() => {
    const url = pathname + search;
    const first = last.current === null;
    const samePage = !first && last.current.pathname === pathname;
    const sameUrl = !first && last.current.url === url;
    last.current = { pathname, url };

    if (sameUrl || (first && hash)) return undefined; // only the #fragment changed, or a deep link to one

    if (navigationType === 'POP') {
      const target = positions.get(key) || 0;
      if (target === 0) {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        return undefined;
      }
      // Lazy pages and fetched lists grow after the first paint: retry for up to ~1.5s
      let frame;
      let tries = 0;
      const restore = () => {
        const room = document.documentElement.scrollHeight - window.innerHeight;
        if (room >= target || tries >= 90) {
          window.scrollTo({ top: Math.min(target, Math.max(0, room)), left: 0, behavior: 'instant' });
          return;
        }
        tries += 1;
        frame = requestAnimationFrame(restore);
      };
      restore();
      // Stop trying as soon as the user scrolls on their own
      const cancel = () => cancelAnimationFrame(frame);
      window.addEventListener('wheel', cancel, { passive: true, once: true });
      window.addEventListener('touchstart', cancel, { passive: true, once: true });
      window.addEventListener('keydown', cancel, { once: true });
      return () => {
        cancel();
        window.removeEventListener('wheel', cancel);
        window.removeEventListener('touchstart', cancel);
        window.removeEventListener('keydown', cancel);
      };
    }

    if (navigationType === 'REPLACE' && samePage) return undefined;

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    return undefined;
  }, [pathname, search, hash, key, navigationType]);

  return null;
}
