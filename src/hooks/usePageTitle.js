import { useEffect } from 'react';

/** "Fleet" becomes "Fleet - Driveaway". */
export const pageTitle = (title) => `${title} - Driveaway`;

/**
 * Sets a page's own title once it is known (a car's name, an invoice number). App.jsx sets a
 * per-route title in a layout effect; this passive effect runs after it, so the page's title wins.
 */
export default function usePageTitle(title) {
  useEffect(() => {
    if (title) document.title = pageTitle(title);
  }, [title]);
}
