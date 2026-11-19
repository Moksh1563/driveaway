/**
 * Car detail: the car wears its category paint; specs are pinned to the photo on
 * leader lines like a body-shop job sheet. Unavailable cars offer an email alert.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, m } from 'framer-motion';
import { ArrowLeft, ArrowRight, Bell, Shield, MapPin, Sparkles, CalendarX, Star } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/ui/StarRating';
import Reveal from '../components/ui/Reveal';
import NotifyAvailabilityModal from '../components/cars/NotifyAvailabilityModal';
import CarHeroPhoto from '../components/cars/CarHeroPhoto';
import { cardPhotoProps } from '../components/cars/carPhoto';
import { sizedImage, handleImageError } from '../utils/image';
import { carTitle, paintFor, paintStyle, pluralLower, rupees } from '../theme/paints';
import { Bone, CarDetailSkeleton } from '../components/ui/Skeletons';
import { SPRING, viewSwap } from '../theme/motion';
import { isCarMorphing } from '../components/cars/useCarMorph';
import { formatDay } from '../utils/dates';
import usePageTitle from '../hooks/usePageTitle';

// How long the card-to-hero photo morph takes to land (the view transition's group glide is 520ms)
const MORPH_MS = 400;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function CarDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [fullCar, setFullCar] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null); // { notFound, message }
  const [reloadKey, setReloadKey] = useState(0);
  const [activeImage, setActiveImage] = useState('main');
  const [showNotifyModal, setShowNotifyModal] = useState(false);

  // A car card hands over the car it was showing (router state), so the photo, name and price are on
  // screen at once and the card's photo has somewhere to morph to; the full record then replaces it
  const handed = location.state?.car;
  const preview = handed && handed._id === id ? handed : null;
  const car = loading ? preview : fullCar;
  // Arrived on the photo morph (not a reload or back/forward visit that kept the hand-over): the spec
  // tags wait for the photo to land
  const [morphed] = useState(() => Boolean(preview) && isCarMorphing());
  // The page opened straight onto the car (handed over by a card), so there is no skeleton for it to fade in over
  const [openedOnCar] = useState(() => Boolean(preview));

  // A different car starts on its main photo (a reload of the same car keeps the one being looked at)
  const photosFor = useRef(id);
  useEffect(() => {
    if (photosFor.current !== id) {
      photosFor.current = id;
      setActiveImage('main');
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/cars/${id}`)
      .then(({ data }) => { if (!cancelled) { setFullCar(data.car); setReviews(data.reviews || []); setLoadError(null); } })
      .catch((err) => {
        if (cancelled) return;
        // Only a 404 (or a malformed id) means the car is gone; anything else is a connection problem
        const status = err.response?.status;
        setFullCar(null);
        setLoadError({ notFound: status === 404 || status === 400, message: err.response?.data?.message || 'Could not load this car.' });
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id, reloadKey]);

  usePageTitle(car ? carTitle(car) : null);

  // Phones: the price bar slides up from the bottom edge once, after the hero has arrived
  const barArrived = useRef(false);
  const slideUpOnce = useCallback((el) => {
    if (!el || barArrived.current) return;
    barArrived.current = true;
    if (typeof el.animate !== 'function' || reducedMotion()) return;
    el.animate(
      [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }],
      { duration: 520, delay: 450, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'backwards' }
    );
  }, []);

  // The page itself, for a car from the card (preview) or the full record
  const renderCar = () => {
    const paint = paintFor(car.type);
    // car.status is the effective status: Maintenance (set by the admin), Rented (a booking covers
    // today) or Available. Only Maintenance stops new bookings; a booked car can take later dates.
    const inMaintenance = car.status === 'Maintenance' || car.adminStatus === 'Maintenance';
    const bookedNow = !inMaintenance && (car.bookedNow || car.status === 'Rented');
    const available = !inMaintenance && !bookedNow;
    const freeFrom = bookedNow && car.nextFreeDate ? formatDay(car.nextFreeDate, { day: 'numeric', month: 'short' }) : '';
    const statusNote = inMaintenance ? 'In maintenance' : bookedNow ? (freeFrom ? `Booked until ${freeFrom}` : 'Booked right now') : '';
    const images = ['main', 'img1', 'img2', 'img3', 'img4'].map((key) => ({ key, src: car.images?.[key] })).filter((i) => i.src);
    const currentImage = car.images?.[activeImage] || car.images?.main;
    const credit = (car.imageCredits || []).find((c) => c.url === currentImage);
    // What shows while a full-size photo loads: the card's own photo on arrival from a card,
    // otherwise the gallery thumbnail (already loaded for the strip below)
    const standIn = preview && currentImage === car.images?.main
      ? cardPhotoProps(currentImage)
      : images.length > 1 ? { src: sizedImage(currentImage, 320) } : null;

    const specs = [
      { label: 'Seats', value: car.seats },
      { label: 'Fuel', value: car.fuelType },
      { label: 'Gearbox', value: car.transmission },
      { label: 'Mileage', value: car.mileage || 'n/a' },
      { label: 'Luggage', value: car.luggage },
      { label: 'Year', value: car.yearModel },
    ].filter((s) => s.value !== undefined && s.value !== null && s.value !== '');

    const book = () => {
      if (!user) { navigate('/login', { state: { from: `/booking/${car._id}` } }); return; }
      navigate(`/booking/${car._id}`);
    };

    const nameChars = Math.max(...car.name.split(' ').map((w) => w.length), 8);

    return (
      <m.div key={car._id} variants={viewSwap} initial={openedOnCar ? false : 'initial'} animate="animate" className="pt-[72px]" style={paintStyle(car.type)}>
        {/* Paint band */}
        <section className="lacquer on-paint">
          <div className="page-container pt-8 pb-44 lg:pb-52">
            <Link to={`/fleet?type=${car.type}`} className="inline-flex items-center gap-2 text-sm font-semibold">
              <ArrowLeft className="h-4 w-4" /> All {pluralLower(car.type)}
            </Link>
            <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
              <div style={{ containerType: 'inline-size' }} className="min-w-0 flex-1">
                {/* The name and paint line come into focus as the page arrives */}
                <h1 className="display focus-in" style={{ fontSize: `min(5.5rem, calc(100cqw / ${Math.min(nameChars, 22) * 0.9}))`, '--d': '40ms' }}>
                  {car.name}
                </h1>
                <p className="mt-4 code-label text-[13px] focus-in" style={{ '--d': '140ms', '--rise': '10px' }}>{car.company} · {car.yearModel} · Paint {paint.no} {paint.name}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="page-container -mt-36 grid gap-10 pb-20 lg:-mt-44 lg:grid-cols-12">
          {/* Photo stage with job-sheet spec tags */}
          <div className="min-w-0 lg:col-span-8">
            <CarHeroPhoto
              carId={car._id}
              src={currentImage}
              standIn={standIn}
              alt={carTitle(car)}
              unlit={!available}
              statusNote={statusNote}
              specs={specs}
              pinDelay={morphed ? MORPH_MS : 0}
            />

            {/* Thumbnails: the active ring slides from one to the next */}
            {images.length > 1 && (
              <m.div layoutScroll className="-mx-1 mt-3 flex gap-3 overflow-x-auto p-1">
                {images.map((img, i) => {
                  const active = activeImage === img.key;
                  return (
                    <button
                      key={img.key}
                      type="button"
                      onClick={() => setActiveImage(img.key)}
                      aria-label={`Show photo ${i + 1}`}
                      aria-pressed={active}
                      className={`group/thumb relative aspect-[16/10] w-32 flex-shrink-0 rounded-xl transition-opacity duration-200 ease-out ${active ? '' : 'opacity-70 hover:opacity-100'}`}
                    >
                      <span className="block h-full w-full overflow-hidden rounded-xl transition-transform duration-150 ease-out group-active/thumb:scale-[0.98]">
                        <img src={sizedImage(img.src, 320)} alt="" loading="lazy" decoding="async" onError={(e) => handleImageError(e, 320)} className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover/thumb:scale-105" />
                      </span>
                      {active && (
                        <m.span layoutId="car-thumb-ring" transition={SPRING} className="pointer-events-none absolute -inset-1 rounded-[16px] border-2 border-ink" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </m.div>
            )}

            {credit && (
              <p className="mt-3 text-xs text-muted">
                Photo: {credit.author}, {credit.license}, via{' '}
                {/* Only web links become anchors (React still renders javascript: hrefs) */}
                {/^https?:\/\//i.test(credit.source || '') ? (
                  <a href={credit.source} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">Wikimedia Commons</a>
                ) : (
                  'Wikimedia Commons'
                )}
              </p>
            )}

            {/* Specs as a sheet (all sizes; the tags above are a desktop flourish). Each cell's label
                and value rise in as the sheet scrolls into view; the cells stay put so the hairlines hold. */}
            <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-chip border border-line bg-line sm:grid-cols-3">
              {specs.map((s, i) => (
                <Reveal key={s.label} className="bg-ground p-5" delay={i * 50}>
                  <dt className="code-label text-[11px] text-muted">{s.label}</dt>
                  <dd className="mt-1 font-wide font-black uppercase tracking-tight text-lg">{s.value}</dd>
                </Reveal>
              ))}
            </dl>

            {car.description && (
              <Reveal variant="focus" className="mt-10 max-w-2xl">
                <h2 className="font-wide font-black uppercase tracking-tight text-xl">About this car</h2>
                <p className="mt-3 text-lg leading-relaxed text-muted">{car.description}</p>
              </Reveal>
            )}
          </div>

          {/* Booking panel: the price comes into focus just after the name. Arriving on the photo morph
              it only rises and fades, so a blur over this large shadowed card never competes with the
              photo landing */}
          <aside className="min-w-0 lg:col-span-4">
            <div
              className={`sticky top-[96px] rounded-chip border border-line bg-surface p-6 shadow-lift ${morphed ? 'enter' : 'focus-in'}`}
              style={{ '--d': '180ms', '--rise': morphed ? '10px' : undefined }}
            >
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-wide font-black text-3xl">{rupees(car.dailyRate)}</p>
                <p className="text-sm text-muted">per day</p>
              </div>
              {car.totalReviews > 0 && (
                <a href="#reviews" className="mt-2 inline-flex items-center gap-1.5 text-sm hover:underline">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="font-semibold">{car.averageRating}</span>
                  <span className="text-muted">from {car.totalReviews} reviews</span>
                </a>
              )}

              {available && (
                <button type="button" onClick={book} className="btn-paint mt-6 w-full !py-4 text-base">
                  Book this car <ArrowRight className="h-5 w-5" />
                </button>
              )}
              {bookedNow && (
                <>
                  <p className="mt-6 rounded-xl bg-ink/[0.05] px-4 py-3 text-sm">
                    {freeFrom
                      ? <><strong>Booked until {freeFrom}.</strong> You can book it for dates from then on.</>
                      : <><strong>Booked right now.</strong> You can still book it for later dates.</>}
                  </p>
                  <button type="button" onClick={book} className="btn-paint mt-3 w-full !py-4 text-base">
                    Book later dates <ArrowRight className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => setShowNotifyModal(true)} className="btn-line mt-3 w-full !py-3.5">
                    <Bell className="h-4 w-4" /> Email me when it is free
                  </button>
                </>
              )}
              {inMaintenance && (
                <>
                  <p className="mt-6 rounded-xl bg-ink/[0.05] px-4 py-3 text-sm">
                    This car is <strong>in maintenance</strong> right now. We will email you the moment it is free.
                  </p>
                  <button type="button" onClick={() => setShowNotifyModal(true)} className="btn-ink mt-3 w-full !py-4 text-base">
                    <Bell className="h-5 w-5" /> Notify me when free
                  </button>
                </>
              )}

              <ul className="mt-6 space-y-3 border-t border-line pt-6 text-sm">
                <li className="flex items-center gap-3"><Shield className="h-4 w-4 text-muted" /> Zero security deposit</li>
                <li className="flex items-center gap-3"><MapPin className="h-4 w-4 text-muted" /> Pick up at any of 8 Ahmedabad hubs</li>
                <li className="flex items-center gap-3"><Sparkles className="h-4 w-4 text-muted" /> Cleaned and checked before every rental</li>
                <li className="flex items-center gap-3"><CalendarX className="h-4 w-4 text-muted" /> Free cancellation before your pickup day</li>
              </ul>
            </div>
          </aside>
        </div>

        <NotifyAvailabilityModal car={car} isOpen={showNotifyModal} onClose={() => setShowNotifyModal(false)} />

        {/* Reviews: the heading comes into focus, the cards rise in as they scroll into view */}
        <section id="reviews" className="border-t border-line bg-surface scroll-mt-24">
          <div className="page-container py-20">
            <Reveal variant="focus" className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="display text-4xl sm:text-5xl">Driver reviews</h2>
              {!loading && reviews.length > 0 && <p className="text-muted">{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</p>}
            </Reveal>
            {loading ? (
              // The car came from a card and its reviews are still on the way
              <div className="mt-10 grid gap-6 md:grid-cols-2" aria-hidden="true">
                {[0, 1].map((i) => <Bone key={i} className="h-40 !rounded-chip" />)}
              </div>
            ) : reviews.length === 0 ? (
              <p className="mt-8 rounded-chip border border-dashed border-line p-10 text-center text-muted">
                No reviews yet. Drivers can review a car after their rental is completed.
              </p>
            ) : (
              <Reveal className="mt-10 grid gap-6 md:grid-cols-2" stagger={60}>
                {reviews.map((review) => (
                  <figure key={review._id} className="rounded-chip border border-line bg-ground p-6">
                    <div className="flex items-center justify-between gap-4">
                      <StarRating value={review.rating} size="sm" />
                      <span className="text-xs text-muted">{new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    {review.reviewText && <blockquote className="mt-4 text-lg leading-snug">{review.reviewText}</blockquote>}
                    <figcaption className="mt-5 text-sm font-semibold">{review.user?.name || 'Driveaway driver'}</figcaption>
                  </figure>
                ))}
              </Reveal>
            )}
          </div>
        </section>

        {/* Phones: price and the main action stay in reach. Sticky inside the page, so it comes to rest
            above the footer instead of covering it. */}
        <div ref={slideUpOnce} className="sticky bottom-0 z-30 border-t border-line bg-ground/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-wide font-black text-xl leading-none">
                {rupees(car.dailyRate)} <span className="text-sm font-normal text-muted [font-stretch:100%]">per day</span>
              </p>
              {statusNote && <p className="mt-1 truncate text-xs text-muted">{statusNote}</p>}
            </div>
            {inMaintenance ? (
              <button type="button" onClick={() => setShowNotifyModal(true)} className="btn-ink flex-shrink-0 !px-5 !py-3">
                <Bell className="h-4 w-4" /> Notify me
              </button>
            ) : (
              <button type="button" onClick={book} className="btn-paint flex-shrink-0 !px-5 !py-3">
                {bookedNow ? 'Book later dates' : 'Book this car'} <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </m.div>
    );
  };

  // The skeleton (or the error) fades out over the car as it arrives. The car itself sits outside
  // AnimatePresence: framer-motion 11 never unregisters a layout element (the thumbnail ring) that
  // unmounts inside a presence child, which would leave the car unable to finish leaving.
  let placeholder = null;
  if (!car && loading) {
    placeholder = (
      <m.div key="loading" variants={viewSwap} initial="initial" animate="animate" exit="exit">
        <CarDetailSkeleton />
      </m.div>
    );
  } else if (!car) {
    const notFound = loadError?.notFound;
    placeholder = (
      <m.div key="error" variants={viewSwap} initial="initial" animate="animate" exit="exit" className="page-container grid min-h-screen place-items-center pt-[72px] text-center">
        <div role={notFound ? undefined : 'alert'}>
          <h1 className="display text-5xl">{notFound ? 'Car not found' : 'Could not load this car'}</h1>
          <p className="mt-4 text-muted">{notFound ? 'It may have left the fleet.' : loadError?.message}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {!notFound && <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="btn-ink">Try again</button>}
            <Link to="/fleet" className={notFound ? 'btn-ink' : 'btn-line'}>Back to the fleet</Link>
          </div>
        </div>
      </m.div>
    );
  }

  return (
    <>
      {car && renderCar()}
      <AnimatePresence mode="popLayout" initial={false}>{placeholder}</AnimatePresence>
    </>
  );
}
