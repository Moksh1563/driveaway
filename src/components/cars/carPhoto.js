import { sizedImage, imageSrcSet } from '../../utils/image';

const CARD_PHOTO_SIZES = '(min-width: 1280px) 30vw, (min-width: 640px) 50vw, 100vw';

/**
 * src / srcSet / sizes for a car card's photo. The car page uses the very same attributes for the
 * stand-in under its hero photo, so the browser picks the copy the card already loaded and the
 * card's photo has something on screen to morph into before the full-size photo arrives.
 */
export const cardPhotoProps = (url) => ({
  src: sizedImage(url, 640),
  srcSet: imageSrcSet(url, [400, 640, 960]),
  sizes: CARD_PHOTO_SIZES,
});

let carPage;
/** Starts loading the car page's code (on card hover or focus) so a click renders it straight away. */
export const preloadCarPage = () => {
  if (!carPage) {
    carPage = import('../../pages/CarDetailPage').catch(() => {
      carPage = undefined; // try again on the next hover
    });
  }
  return carPage;
};
