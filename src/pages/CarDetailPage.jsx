/**
 * Car detail: the car wears its category paint; specs are pinned to the photo on
 * leader lines like a body-shop job sheet. Unavailable cars offer an email alert.
 */
import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Bell, Shield, MapPin, Sparkles, CalendarX, Star } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/ui/StarRating';
import NotifyAvailabilityModal from '../components/cars/NotifyAvailabilityModal';
import { sizedImage, imageSrcSet, handleImageError } from '../utils/image';
import { carTitle, paintFor, paintStyle, pluralLower, rupees } from '../theme/paints';
import { CarDetailSkeleton } from '../components/ui/Skeletons';

// Where each spec tag sits around the photo (percent of the frame) and which side its leader line runs to
const PINS = [
  { top: '14%', left: '-2%', side: 'right' },
  { top: '14%', right: '-2%', side: 'left' },
  { top: '48%', left: '-2%', side: 'right' },
  { top: '48%', right: '-2%', side: 'left' },
  { bottom: '12%', left: '-2%', side: 'right' },
  { bottom: '12%', right: '-2%', side: 'left' },
];

export default function CarDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [car, setCar] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState('main');
  const [showNotifyModal, setShowNotifyModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/cars/${id}`)
      .then(({ data }) => { if (!cancelled) { setCar(data.car); setReviews(data.reviews || []); setActiveImage('main'); } })
      .catch(() => { if (!cancelled) setCar(null); })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return <CarDetailSkeleton />;
  }

  if (!car) {
    return (
      <div className="page-container grid min-h-screen place-items-center pt-[72px] text-center">
        <div>
          <h1 className="display text-5xl">Car not found</h1>
          <p className="mt-4 text-muted">It may have left the fleet.</p>
          <Link to="/fleet" className="btn-ink mt-8">Back to the fleet</Link>
        </div>
      </div>
    );
  }

  const paint = paintFor(car.type);
  const available = car.status === 'Available';
  const images = ['main', 'img1', 'img2', 'img3', 'img4'].map((key) => ({ key, src: car.images?.[key] })).filter((i) => i.src);
  const currentImage = car.images?.[activeImage] || car.images?.main;
  const credit = (car.imageCredits || []).find((c) => c.url === currentImage);

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
    <div className="pt-[72px]" style={paintStyle(car.type)}>
      {/* Paint band */}
      <section className="lacquer on-paint">
        <div className="page-container pt-8 pb-44 lg:pb-52">
          <Link to={`/fleet?type=${car.type}`} className="inline-flex items-center gap-2 text-sm font-semibold">
            <ArrowLeft className="h-4 w-4" /> All {pluralLower(car.type)}
          </Link>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div style={{ containerType: 'inline-size' }} className="min-w-0 flex-1">
              <h1 className="display" style={{ fontSize: `min(5.5rem, calc(100cqw / ${Math.min(nameChars, 22) * 0.9}))` }}>
                {car.name}
              </h1>
              <p className="mt-4 code-label text-[13px]">{car.company} · {car.yearModel} · Paint {paint.no} {paint.name}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="page-container -mt-36 grid gap-10 pb-20 lg:-mt-44 lg:grid-cols-12">
        {/* Photo stage with job-sheet spec tags */}
        <div className="min-w-0 lg:col-span-8">
          <div className="relative">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[28px] rounded-bl-[96px] bg-ink/10 shadow-lift">
              <AnimatePresence initial={false}>
                <motion.img
                  key={currentImage}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  src={sizedImage(currentImage, 1600, 75)}
                  srcSet={imageSrcSet(currentImage, [800, 1200, 1600])}
                  sizes="(min-width: 1024px) 64vw, 100vw"
                  alt={carTitle(car)}
                  onError={(e) => handleImageError(e, 1200)}
                  className={`absolute inset-0 h-full w-full object-cover ${available ? '' : 'unlit'}`}
                />
              </AnimatePresence>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,rgb(255_255_255/0.2),transparent_30%)]" />
              {!available && (
                <span className="absolute left-5 top-5 rounded-full bg-[#0C0C0D]/85 px-3.5 py-2 code-label text-[12px] text-white">
                  {car.status} right now
                </span>
              )}
            </div>

            {/* Leader-line spec tags (desktop) */}
            <ul className="pointer-events-none absolute inset-0 hidden xl:block" aria-hidden="true">
              {specs.slice(0, 6).map((s, i) => {
                const pin = PINS[i];
                const { side, ...pos } = pin;
                return (
                  <li key={s.label} className="absolute flex items-center" style={{ ...pos, flexDirection: side === 'right' ? 'row' : 'row-reverse', '--i': i }}>
                    <span className="pin-tag rounded-lg border border-line bg-ground px-3 py-2 shadow-soft">
                      <span className="block code-label text-[10px] text-muted">{s.label}</span>
                      <span className="block font-semibold text-sm leading-tight">{s.value}</span>
                    </span>
                    <span className="pin-line h-[2px] w-14 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.25)]" style={{ transformOrigin: side === 'right' ? 'left' : 'right' }} />
                    <span className="pin-dot h-3 w-3 rounded-full border-2 border-white bg-paint shadow-soft" />
                  </li>
                );
              })}
            </ul>
          </div>

          {images.length > 1 && (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={img.key}
                  type="button"
                  onClick={() => setActiveImage(img.key)}
                  aria-label={`Show photo ${i + 1}`}
                  aria-pressed={activeImage === img.key}
                  className={`relative aspect-[16/10] w-32 flex-shrink-0 overflow-hidden rounded-xl transition ${
                    activeImage === img.key ? 'ring-2 ring-ink ring-offset-2 ring-offset-ground' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={sizedImage(img.src, 320)} alt="" loading="lazy" decoding="async" onError={(e) => handleImageError(e, 320)} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {credit && (
            <p className="mt-3 text-xs text-muted">
              Photo: {credit.author}, {credit.license}, via{' '}
              <a href={credit.source} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">Wikimedia Commons</a>
            </p>
          )}

          {/* Specs as a sheet (all sizes; the tags above are a desktop flourish) */}
          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-chip border border-line bg-line sm:grid-cols-3">
            {specs.map((s) => (
              <div key={s.label} className="bg-ground p-5">
                <dt className="code-label text-[11px] text-muted">{s.label}</dt>
                <dd className="mt-1 font-wide font-black uppercase tracking-tight text-lg">{s.value}</dd>
              </div>
            ))}
          </dl>

          {car.description && (
            <div className="mt-10 max-w-2xl">
              <h2 className="font-wide font-black uppercase tracking-tight text-xl">About this car</h2>
              <p className="mt-3 text-lg leading-relaxed text-muted">{car.description}</p>
            </div>
          )}
        </div>

        {/* Booking panel */}
        <aside className="min-w-0 lg:col-span-4">
          <div className="sticky top-[96px] rounded-chip border border-line bg-surface p-6 shadow-lift">
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

            {available ? (
              <button type="button" onClick={book} className="btn-paint mt-6 w-full !py-4 text-base">
                Book this car <ArrowRight className="h-5 w-5" />
              </button>
            ) : (
              <>
                <p className="mt-6 rounded-xl bg-ink/[0.05] px-4 py-3 text-sm">
                  This car is <strong>{car.status.toLowerCase()}</strong> right now. We will email you the moment it is free.
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
              <li className="flex items-center gap-3"><CalendarX className="h-4 w-4 text-muted" /> Free cancellation</li>
            </ul>
          </div>
        </aside>
      </div>

      <NotifyAvailabilityModal car={car} isOpen={showNotifyModal} onClose={() => setShowNotifyModal(false)} />

      {/* Reviews */}
      <section id="reviews" className="border-t border-line bg-surface scroll-mt-24">
        <div className="page-container py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="display text-4xl sm:text-5xl">Driver reviews</h2>
            {reviews.length > 0 && <p className="text-muted">{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</p>}
          </div>
          {reviews.length === 0 ? (
            <p className="mt-8 rounded-chip border border-dashed border-line p-10 text-center text-muted">
              No reviews yet. Drivers can review a car after their rental is completed.
            </p>
          ) : (
            <div className="mt-10 grid gap-6 md:grid-cols-2">
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
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
