// Image helpers: request appropriately sized, modern-format images instead of full-size originals.

export const FALLBACK_CAR_IMAGE = 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8';

// Wikimedia serves thumbnails at a fixed set of standard widths; other widths are throttled.
const WIKIMEDIA_WIDTHS = [250, 330, 500, 960, 1280, 1920];
const isWikimediaThumb = (url) => url.includes('upload.wikimedia.org') && url.includes('/thumb/');

/**
 * Returns a resized URL for Unsplash and Wikimedia Commons images.
 * Other URLs (e.g. /uploads/...) are returned unchanged.
 */
export function sizedImage(url, width = 800, quality = 70) {
  if (!url) return sizedImage(FALLBACK_CAR_IMAGE, width, quality);
  if (isWikimediaThumb(url)) {
    const w = WIKIMEDIA_WIDTHS.find((x) => x >= width) || WIKIMEDIA_WIDTHS[WIKIMEDIA_WIDTHS.length - 1];
    return url.replace(/\/(\d+)px-([^/]+)$/, `/${w}px-$2`);
  }
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
    const sizes = [...new Set(widths.map((w) => WIKIMEDIA_WIDTHS.find((x) => x >= w) || 1920))];
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
