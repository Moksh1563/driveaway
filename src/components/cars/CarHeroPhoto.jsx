import React, { useCallback, useRef, useState } from 'react';
import { m } from 'framer-motion';
import { sizedImage, imageSrcSet, handleImageError } from '../../utils/image';
import { carPhotoTransition } from '../../hooks/useViewTransitionNavigate';
import useScrollDrift from '../../hooks/useScrollDrift';
import { EASE } from '../../theme/motion';

// Where each spec tag sits around the photo (percent of the frame) and which side its leader line runs to
const PINS = [
  { top: '14%', left: '-2%', side: 'right' },
  { top: '14%', right: '-2%', side: 'left' },
  { top: '48%', left: '-2%', side: 'right' },
  { top: '48%', right: '-2%', side: 'left' },
  { bottom: '12%', left: '-2%', side: 'right' },
  { bottom: '12%', right: '-2%', side: 'left' },
];

/**
 * One photo in the frame: its stand-in (a smaller copy that is already loaded: the card's photo
 * or the gallery thumbnail) shows at once, and the full-size photo sharpens in over it once loaded.
 * Every photo after the first fades in over the one before it, settling from a slight zoom.
 */
function PhotoLayer({ src, standIn, alt, unlit, fadeIn, onIn }) {
  const [loaded, setLoaded] = useState(false);
  // A photo already in the browser's cache can be complete before its load event is seen
  const seeCached = useCallback((img) => {
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);
  return (
    <m.div
      initial={fadeIn ? { opacity: 0, scale: 1.03 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: EASE.out }}
      onAnimationComplete={onIn}
      className={`absolute inset-0 ${unlit ? 'unlit' : ''}`}
    >
      {standIn && (
        <img src={standIn.src} srcSet={standIn.srcSet} sizes={standIn.sizes} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <img
        ref={seeCached}
        src={sizedImage(src, 1600, 75)}
        srcSet={imageSrcSet(src, [800, 1200, 1600])}
        sizes="(min-width: 1024px) 64vw, 100vw"
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={(e) => handleImageError(e, 1200)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </m.div>
  );
}

/**
 * The frame's photos: a newly chosen photo is laid over the last one. The photos beneath are only
 * dropped once a photo above them has fully faded in, so quick clicks through the thumbnails always
 * keep an opaque photo under the incoming one and the empty frame never shows through.
 */
function PhotoStack({ src, standIn, alt, unlit }) {
  const [layers, setLayers] = useState(() => [{ id: 0, src, standIn }]);
  const [shown, setShown] = useState(src);
  // Adjusting state while rendering (React's pattern for state derived from a prop change)
  if (src !== shown) {
    setShown(src);
    setLayers((ls) => [...ls, { id: ls[ls.length - 1].id + 1, src, standIn }]);
  }
  // A photo has fully faded in: everything under it is now hidden, so let it go
  const settle = useCallback((id) => setLayers((ls) => {
    const at = ls.findIndex((layer) => layer.id === id);
    return at > 0 ? ls.slice(at) : ls;
  }), []);
  return layers.map((layer, i) => (
    <PhotoLayer
      key={layer.id}
      src={layer.src}
      standIn={layer.standIn}
      alt={i === layers.length - 1 ? alt : ''}
      unlit={unlit}
      fadeIn={layer.id > 0}
      onIn={() => settle(layer.id)}
    />
  ));
}

/**
 * The car page's photo stage: the hero frame (the photo a car card morphs into), its status pill and
 * the desktop job-sheet spec tags. As the page scrolls on, the whole stage eases back (drifts down a
 * little, shrinks and dims); with reduced motion it stays put.
 * `pinDelay` (ms) holds the spec tags back until a morphing photo has landed.
 */
export default function CarHeroPhoto({ carId, src, standIn, alt, unlit, statusNote, specs, pinDelay = 0 }) {
  const stageRef = useRef(null);
  const drift = useScrollDrift(stageRef, { y: [0, 64], scale: [1, 0.95], opacity: [1, 0.6] });

  return (
    <m.div ref={stageRef} style={drift} className="relative">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[28px] rounded-bl-[96px] bg-ink/10 shadow-lift">
        {/* The shared photo name sits on the frame, not on a photo, so it stays put while the gallery changes photos */}
        <div data-car-photo={carId} style={carPhotoTransition(carId)} className="absolute inset-0 overflow-hidden rounded-[inherit]">
          <PhotoStack src={src} standIn={standIn} alt={alt} unlit={unlit} />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,rgb(255_255_255/0.2),transparent_30%)]" />
        {statusNote && (
          <span className="absolute left-5 top-5 rounded-full bg-[#0C0C0D]/85 px-3.5 py-2 code-label text-[12px] text-white">
            {statusNote}
          </span>
        )}
      </div>

      {/* Leader-line spec tags (desktop): tag rises, line draws, dot lands */}
      <ul className="pointer-events-none absolute inset-0 hidden xl:block" aria-hidden="true">
        {specs.slice(0, 6).map((s, i) => {
          const pin = PINS[i];
          const { side, ...pos } = pin;
          const later = (base) => (pinDelay ? { animationDelay: `${base + pinDelay + i * 90}ms` } : undefined);
          return (
            <li key={s.label} className="absolute flex items-center" style={{ ...pos, flexDirection: side === 'right' ? 'row' : 'row-reverse', '--i': i }}>
              <span className="pin-tag rounded-lg border border-line bg-ground px-3 py-2 shadow-soft" style={later(250)}>
                <span className="block code-label text-[10px] text-muted">{s.label}</span>
                <span className="block font-semibold text-sm leading-tight">{s.value}</span>
              </span>
              <span className="pin-line h-[2px] w-14 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.25)]" style={{ transformOrigin: side === 'right' ? 'left' : 'right', ...later(350) }} />
              <span className="pin-dot h-3 w-3 rounded-full border-2 border-white bg-paint shadow-soft" style={later(560)} />
            </li>
          );
        })}
      </ul>
    </m.div>
  );
}
