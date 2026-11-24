// Image helpers: request appropriately sized, modern-format images instead of full-size originals.

export const FALLBACK_CAR_IMAGE = 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8';

// Wikimedia serves thumbnails at a fixed set of standard widths; other widths are throttled. The
// fleet's photos are thumb.wikimedia.org thumbnails; upload.wikimedia.org serves the same paths.
const WIKIMEDIA_WIDTHS = [250, 330, 500, 960, 1280, 1920];
const isWikimediaThumb = (url) => /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(url) && url.includes('/thumb/');
const WIKIMEDIA_PX = /\/(\d+)px-([^/]+)$/;
// The smallest standard width that covers the request, but never wider than the thumbnail the URL
// already names: Wikimedia will not scale past the original, and the fleet was picked at 1280px
const wikimediaWidth = (url, width) => {
  const own = Number(url.match(WIKIMEDIA_PX)?.[1]) || Infinity;
  const standard = WIKIMEDIA_WIDTHS.find((x) => x >= width) || WIKIMEDIA_WIDTHS[WIKIMEDIA_WIDTHS.length - 1];
  return Math.min(standard, own);
};

/**
 * Returns a resized URL for Unsplash and Wikimedia Commons images.
 * Other URLs (e.g. /uploads/...) are returned unchanged.
 */
// When the API lives on another domain (VITE_API_BASE_URL like https://x.onrender.com/api),
// older admin uploads saved as "/uploads/..." must load from the API's origin, not the website's.
const API_ORIGIN = (() => {
  try {
    const base = import.meta.env.VITE_API_BASE_URL;
    return base && /^https?:\/\//.test(base) ? new URL(base).origin : '';
  } catch {
    return '';
  }
})();

export function sizedImage(url, width = 800, quality = 70) {
  if (!url) return sizedImage(FALLBACK_CAR_IMAGE, width, quality);
  if (url.startsWith('/uploads/')) return API_ORIGIN + url;
  if (isWikimediaThumb(url)) return url.replace(WIKIMEDIA_PX, `/${wikimediaWidth(url, width)}px-$2`);
  if (!url.includes('images.unsplash.com')) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('w', String(width));
    u.searchParams.set('q', String(quality));
    u.searchParams.set('auto', 'format');
    u.searchParams.set('fit', 'crop');
    return u.toString();
  } catch {
    return url;
  }
}

/** srcSet for responsive <img> tags. */
export function imageSrcSet(url, widths = [400, 640, 960]) {
  if (!url) return undefined;
  if (isWikimediaThumb(url)) {
    const sizes = [...new Set(widths.map((w) => wikimediaWidth(url, w)))];
    return sizes.map((w) => `${sizedImage(url, w)} ${w}w`).join(', ');
  }
  if (!url.includes('images.unsplash.com')) return undefined;
  return widths.map((w) => `${sizedImage(url, w)} ${w}w`).join(', ');
}

/** onError handler that swaps in the fallback image once (no infinite loop). */
export function handleImageError(e, width = 800) {
  const img = e.currentTarget;
  if (img.dataset.fallback) return;
  img.dataset.fallback = '1';
  img.removeAttribute('srcset');
  img.src = sizedImage(FALLBACK_CAR_IMAGE, width);
}
