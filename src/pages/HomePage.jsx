import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, m } from 'framer-motion';
import { ArrowRight, ArrowUpRight, MapPin } from 'lucide-react';
import api from '../api/axios';
import CarCard from '../components/cars/CarCard';
import StarRating from '../components/ui/StarRating';
import Reveal from '../components/ui/Reveal';
import CountUp from '../components/ui/CountUp';
import PaintPicker from '../components/home/PaintPicker';
import useScrollDrift from '../hooks/useScrollDrift';
import { HUBS } from '../theme/hubs';
import { PAINT_ORDER, carTitle, paintFor, paintStyle, plural, pluralLower, rupees } from '../theme/paints';
import { sizedImage, imageSrcSet, handleImageError } from '../utils/image';
import { CarGridSkeleton } from '../components/ui/Skeletons';
import { EASE } from '../theme/motion';


// Booking dates are calendar days in India time: "today" is the IST date, pickup at most 180 days
// ahead, a trip at most 90 days long
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const addDays = (ymd, days) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().split('T')[0];
};

// The hero photo: the same widths and sizes for the <img> and for preloading it, so the browser
// picks the same file both times
const HERO_WIDTHS = [800, 1200, 1600];
const HERO_SIZES = '(min-width: 1024px) 55vw, 100vw';
const heroSrc = (url) => sizedImage(url, 1400, 75);

// Downloads and decodes a hero photo once; resolves when it is ready to paint (or failed, in which
// case the <img> shows its fallback)
const heroPhotos = new Map();
function preloadHero(url, priority = 'high') {
  if (!heroPhotos.has(url)) {
    const img = new Image();
    img.fetchPriority = priority;
    img.decoding = 'async';
    img.sizes = HERO_SIZES;
    const set = imageSrcSet(url, HERO_WIDTHS);
    if (set) img.srcset = set;
    img.src = heroSrc(url);
    heroPhotos.set(url, img.decode().catch(() => {}));
  }
  return heroPhotos.get(url);
}

// The repaint lands the next car with the paint: a beat late, out of a soft blur, while the last
// one dissolves. Any other swap (the first car arriving with the data) is a quick crossfade: the new
// photo fades in over the old one, which leaves only once it is covered.
const HERO_PHOTO = {
  hidden: (repaint) => (repaint ? { opacity: 0, scale: 1.06, filter: 'blur(12px)' } : { opacity: 0 }),
  shown: (repaint) => ({
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: repaint ? { duration: 0.7, delay: 0.25, ease: EASE.out } : { duration: 0.35, ease: EASE.out },
  }),
  gone: (repaint) => ({
    opacity: 0,
    transition: repaint ? { duration: 0.35, delay: 0.25, ease: EASE.in } : { duration: 0.15, delay: 0.35 },
  }),
};

export default function HomePage() {
  const navigate = useNavigate();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [paintType, setPaintType] = useState('Hypercar'); // paint currently on the hero ground
  const [selected, setSelected] = useState('Hypercar');   // paint the visitor picked (content follows instantly)
  const [wipe, setWipe] = useState(null);                  // { type, x, key } while the new paint sweeps in
  const [slip, setSlip] = useState({ location: '', from: '', to: '' });
  const [reviews, setReviews] = useState([]);
  const heroRef = useRef(null);
  const closeRef = useRef(null);
  // As the hero scrolls away the headline drifts and dims and the photo eases inside its frame;
  // the closing headline grows into place as it arrives. Reduced motion holds all of it still.
  const heroDrift = useScrollDrift(heroRef, { y: [0, 36], opacity: [1, 0.25] });
  const photoDrift = useScrollDrift(heroRef, { y: [0, 64] });
  const closeDrift = useScrollDrift(closeRef, { scale: [0.9, 1], opacity: [0.35, 1], offset: ['start end', 'center center'] });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api.get('/cars', { params: { limit: 100, sort: 'rating' }, signal: controller.signal })
      .then(({ data }) => { setCars(data.cars || []); setLoading(false); })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err.response?.data?.message || 'Could not load cars.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  // Group the real fleet by category, in paint-book order. `status` is the effective status:
  // 'Rented' means a booking covers today (later dates are still bookable), 'Maintenance' means
  // the team has taken it off the road.
  const book = useMemo(() => {
    const rank = { Available: 0, Rented: 1, Maintenance: 2 };
    const groups = PAINT_ORDER.map((type) => {
      // Cars ready to drive first, then the ones out on the road, then the ones in maintenance
      const list = cars.filter((c) => c.type === type).sort((a, b) => (rank[a.status] ?? 1) - (rank[b.status] ?? 1));
      const ready = list.filter((c) => c.status === 'Available');
      return {
        type,
        list,
        ready,
        onRoad: list.filter((c) => c.status === 'Rented').length,
        inMaintenance: list.filter((c) => c.status === 'Maintenance').length,
        from: list.length ? Math.min(...list.map((c) => c.dailyRate)) : 0,
        hero: ready[0] || list[0],
      };
    }).filter((g) => g.list.length);
    return groups;
  }, [cars]);

  const group = book.find((g) => g.type === selected);
  const paint = paintFor(selected);
  // Longest headline line in characters drives the font size ("IN FRENCH RACING BLUE." is the widest)
  const headlineChars = Math.max(plural(selected).length + 1, paint.name.length + 4);

  // One motion at a time: scroll back up to the hero first, then sweep the new paint in;
  // the photo cross-fades as the sweep lands.
  const choose = (type, e) => {
    if (type === selected) return;
    const rect = e?.currentTarget?.getBoundingClientRect();
    const x = rect ? `${Math.round(((rect.left + rect.width / 2) / window.innerWidth) * 100)}%` : '50%';
    const paintIn = () => {
      setSelected(type);
      setWipe({ type, x, key: Date.now() });
    };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (window.scrollY <= 0 || reduce) {
      if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'auto' });
      paintIn();
      return;
    }
    let done = false;
    const go = () => { if (!done) { done = true; window.removeEventListener('scrollend', go); paintIn(); } };
    window.addEventListener('scrollend', go, { once: true });
    setTimeout(go, 700); // browsers without scrollend
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const findCars = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set('type', selected);
    if (slip.location) params.set('location', slip.location);
    if (slip.from) params.set('from', slip.from);
    if (slip.to) params.set('to', slip.to);
    navigate(`/fleet?${params.toString()}`);
  };

  const hero = group?.hero;
  const heroId = hero?._id;

  // The photo on show changes only once the next one is downloaded (or has failed, and the <img>
  // shows its fallback), so the frame never goes blank or fades in on a half-loaded image; until
  // then the last photo, or the header photo, holds the frame
  const [heroPhoto, setHeroPhoto] = useState(null); // { url, alt }
  useEffect(() => {
    const url = hero?.images?.main;
    if (!url) {
      // A car without a photo: back to the header photo, never the last car under this car's name
      if (hero) setHeroPhoto(null);
      return undefined;
    }
    let live = true;
    preloadHero(url).then(() => { if (live) setHeroPhoto({ url, alt: carTitle(hero) }); });
    return () => { live = false; };
  }, [hero]);

  // Resting the mouse on a chip starts that category's photo downloading, so the repaint usually
  // has it ready (PaintPicker only calls this after a short dwell, so a sweep along the row is free)
  const previewPaint = (type) => {
    const url = book.find((g) => g.type === type)?.hero?.images?.main;
    if (url) preloadHero(url);
  };

  // Real reviews of the car currently on show (no invented testimonials)
  useEffect(() => {
    if (!heroId) return undefined;
    let cancelled = false;
    api.get(`/reviews/car/${heroId}`)
      .then(({ data }) => { if (!cancelled) setReviews((data || []).filter((r) => r.reviewText)); })
      .catch(() => { if (!cancelled) setReviews([]); });
    return () => { cancelled = true; };
  }, [heroId]);

  return (
    <div>
      {/* ─────────────── FIRST VIEWPORT: the paint you pick ─────────────── */}
      <section
        ref={heroRef}
        aria-label={`${plural(selected)} in ${paint.name}`}
        style={paintStyle(selected)}
        className="on-paint relative mt-[72px] overflow-hidden text-on-paint"
      >
        {/* Ground: the current paint, and the next paint sweeping in from the chosen chip */}
        <div className="lacquer absolute inset-0" style={paintStyle(paintType)} aria-hidden="true" />
        {wipe && (
          <div
            key={wipe.key}
            className="lacquer absolute inset-0 animate-wipe"
            style={{ ...paintStyle(wipe.type), '--wipe-x': wipe.x }}
            onAnimationEnd={() => { setPaintType(wipe.type); setWipe(null); }}
            aria-hidden="true"
          />
        )}

        <div className="page-container relative pt-6 pb-40 lg:pt-8">
          {/* Headline: full width, sized so its longest line always fits */}
          <m.div style={{ containerType: 'inline-size', y: heroDrift.y, opacity: heroDrift.opacity }}>
            <h1
              key={selected}
              className="display"
              style={{ fontSize: `min(5rem, calc(100cqw / ${headlineChars * 0.86}))` }}
            >
              <span className="mask-line"><span style={{ '--i': 0 }}>{plural(selected)},</span></span>
              <span className="mask-line"><span style={{ '--i': 1 }}>in {paint.name}.</span></span>
            </h1>
          </m.div>

          <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-12 lg:gap-10">
          <Reveal className="lg:col-span-5 flex flex-col" delay={250} stagger={90}>
            <p className="max-w-md text-lg leading-snug">
              Hypercars, supercars and luxury cars for hire in Ahmedabad. Pick a paint, pick your dates, collect the keys.
            </p>
            <p className="mt-4 code-label text-[13px]">
              Paint {paint.no}
              {group && (
                <>
                  {` · ${group.list.length} ${group.list.length === 1 ? 'car' : 'cars'} · from `}
                  <CountUp value={group.from} format={rupees} fromZero={false} />
                  {' a day'}
                </>
              )}
              {' · '}{HUBS.length} pickup hubs
            </p>

            {/* Order slip: the working booking search */}
            <form
              onSubmit={findCars}
              className="mt-5 rounded-chip bg-raised p-4 text-ink shadow-lift sm:p-5"
              aria-label="Find a car"
            >
              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 sm:col-span-1">
                  <span className="field-label">Pickup hub</span>
                  <select
                    value={slip.location}
                    onChange={(e) => setSlip((s) => ({ ...s, location: e.target.value }))}
                    className="field"
                  >
                    <option value="">Any hub</option>
                    {HUBS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
                <label className="col-span-2 sm:col-span-1">
                  <span className="field-label">Category</span>
                  <select value={selected} onChange={(e) => choose(e.target.value)} className="field">
                    {(book.length ? book.map((g) => g.type) : PAINT_ORDER).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="field-label">From</span>
                  <input
                    type="date"
                    min={today()}
                    max={addDays(today(), 180)}
                    value={slip.from}
                    onChange={(e) => setSlip((s) => {
                      const from = e.target.value;
                      // Drop a return date that is no longer after pickup or makes the trip too long
                      const keepTo = s.to && from && s.to > from && s.to <= addDays(from, 90);
                      return { ...s, from, to: keepTo || !from ? s.to : '' };
                    })}
                    className="field"
                  />
                </label>
                <label>
                  <span className="field-label">To</span>
                  <input
                    type="date"
                    min={slip.from || today()}
                    max={addDays(slip.from || today(), slip.from ? 90 : 270)}
                    value={slip.to}
                    onChange={(e) => setSlip((s) => ({ ...s, to: e.target.value }))}
                    className="field"
                  />
                </label>
              </div>
              <button type="submit" className="btn-ink mt-4 w-full !py-4 text-base">
                Find {pluralLower(selected)} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </Reveal>

          {/* The car, in a lacquer chip frame */}
          <div className="enter order-first lg:order-none lg:col-span-7" style={{ '--d': '120ms' }}>
            <div className="relative aspect-[16/10] overflow-hidden rounded-[28px] rounded-bl-[96px] bg-black/20 shadow-lift lg:aspect-auto lg:h-full lg:min-h-[340px]">
              {/* Taller than the frame so the photo can ease down inside it as the hero scrolls away */}
              <m.div className="absolute inset-x-0 -top-[12%] bottom-0" style={{ y: photoDrift.y }}>
                {/* Until the cars load, the header photo holds the frame. `custom` tells both the
                    arriving and the leaving photo whether this swap is a repaint (see HERO_PHOTO). */}
                <AnimatePresence initial={false} custom={Boolean(wipe)}>
                  <m.img
                    key={heroPhoto?.url || 'hero'}
                    custom={Boolean(wipe)}
                    variants={HERO_PHOTO}
                    initial="hidden"
                    animate="shown"
                    exit="gone"
                    src={heroPhoto ? heroSrc(heroPhoto.url) : '/images/luxury_hypercars_header.webp'}
                    srcSet={heroPhoto ? imageSrcSet(heroPhoto.url, HERO_WIDTHS) : undefined}
                    sizes={HERO_SIZES}
                    alt={heroPhoto?.alt || 'Driveaway hypercars'}
                    fetchpriority="high"
                    onError={(e) => handleImageError(e, 1200)}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </AnimatePresence>
              </m.div>
              {/* clear-coat highlight, plus one gloss sweep when the page first loads */}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,rgb(255_255_255/0.18),transparent_32%)]" />
              <span className="sheen-sweep" aria-hidden="true" />
              {group?.hero && (
                <Link
                  to={`/cars/${group.hero._id}`}
                  className="absolute bottom-4 right-4 flex items-center gap-3 rounded-full bg-[#0C0C0D]/85 py-2 pl-4 pr-2 text-white hover:bg-[#0C0C0D] transition-colors"
                >
                  <span className="text-sm">
                    <span className="font-semibold">{group.hero.name}</span>
                    <span className="opacity-70"> · {rupees(group.hero.dailyRate)}/day</span>
                  </span>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#0C0C0D]">
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>
        </div>

        {/* Paint picker: the paint book. Choosing a chip widens it and repaints the page from it. */}
        <div className="absolute inset-x-0 bottom-0">
          <div className="page-container">
            {/* While the cars load, all eight paints stand in, so no chip arrives late with the data */}
            <PaintPicker
              groups={book.length ? book : PAINT_ORDER.map((type) => ({ type, list: [] }))}
              selected={selected}
              onChoose={choose}
              onPreview={previewPaint}
            />
          </div>
        </div>
      </section>

      {/* ─────────────── The cars in this paint ─────────────── */}
      <section style={paintStyle(selected)} className="page-container py-20 sm:py-24" aria-labelledby="line-heading">
        <Reveal variant="focus" stagger={90} className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-6">
          <div>
            <h2 id="line-heading" className="display text-4xl sm:text-5xl">
              {group ? <><CountUp value={group.ready.length} /> ready to drive</> : 'The fleet'}
            </h2>
            <p className="mt-3 text-muted">
              {plural(selected)} in {paint.name}
              {group && (group.onRoad || group.inMaintenance)
                ? `, plus ${[
                  group.onRoad ? `${group.onRoad} out on the road` : '',
                  group.inMaintenance ? `${group.inMaintenance} in maintenance` : '',
                ].filter(Boolean).join(' and ')}`
                : ''}.
            </p>
          </div>
          <Link to={`/fleet?type=${selected}`} className="btn-line">
            All {pluralLower(selected)} <ArrowRight className="w-4 h-4" />
          </Link>
        </Reveal>

        {loading ? (
          <CarGridSkeleton count={3} className="mt-10" />
        ) : error ? (
          <div className="mt-10 rounded-chip border border-line p-12 text-center" role="alert">
            <h3 className="font-wide font-black uppercase text-xl">Could not load the fleet</h3>
            <p className="mt-2 text-muted">{error}</p>
            <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="btn-ink mt-6">Try again</button>
          </div>
        ) : (
          <Reveal wrap cellClassName="h-full" className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {(group?.list || []).slice(0, 6).map((car, i) => <CarCard key={car._id} car={car} index={i} />)}
          </Reveal>
        )}
      </section>

      {/* ─────────────── How a booking goes: the axis itself, paint to car to keys ─────────────── */}
      <section className="border-y border-line bg-surface" aria-labelledby="how-heading">
        <div className="page-container py-20 sm:py-24">
          <Reveal variant="focus" stagger={90} className="flex flex-wrap items-end justify-between gap-6">
            <h2 id="how-heading" className="display text-4xl sm:text-5xl">Paint, car, keys.</h2>
            <p className="max-w-sm text-muted">
              Booking takes about two minutes. Pay online now, or pay in cash when you collect the car.
            </p>
          </Reveal>
          <Reveal as="ol" variant="deal" stagger={90} className="mt-10 grid gap-4 md:grid-cols-3">
            <li style={paintStyle(selected)} className="lacquer on-paint flex min-h-[260px] flex-col justify-between rounded-chip rounded-bl-[56px] p-7 shadow-chip">
              <span className="font-wide font-black text-5xl" aria-hidden="true">1</span>
              <span>
                <span className="block font-wide font-black uppercase tracking-tight text-2xl">Pick a paint</span>
                <span className="mt-2 block">You picked {paint.name}: {pluralLower(selected)}, from {group ? rupees(group.from) : '—'} a day.</span>
              </span>
            </li>
            <li className="relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-chip bg-[#0C0C0D] p-7 text-white shadow-chip">
              {group?.hero && (
                <img src={sizedImage(group.hero.images?.main, 640)} alt="" loading="lazy" decoding="async" onError={(e) => handleImageError(e, 640)} className="absolute inset-0 h-full w-full object-cover opacity-55" />
              )}
              <span className="relative font-wide font-black text-5xl" aria-hidden="true">2</span>
              <span className="relative">
                <span className="block font-wide font-black uppercase tracking-tight text-2xl">Choose the car</span>
                <span className="mt-2 block">{group?.hero ? `Like the ${carTitle(group.hero)}, with specs, reviews and rates side by side.` : 'Compare specs, reviews and daily rates.'}</span>
              </span>
            </li>
            <li className="flex min-h-[260px] flex-col justify-between rounded-chip border border-line bg-raised p-7 shadow-chip">
              <span className="font-wide font-black text-5xl" aria-hidden="true">3</span>
              <span>
                <span className="block font-wide font-black uppercase tracking-tight text-2xl">Collect the keys</span>
                <span className="mt-2 block text-muted">
                  At {slip.location || 'any of our eight hubs'}. Show your licence, drive away, and your invoice arrives as a PDF.
                </span>
              </span>
            </li>
          </Reveal>
        </div>
      </section>

      {/* ─────────────── Real reviews of the car on show ─────────────── */}
      {reviews.length > 0 && group?.hero && (
        <section className="page-container py-20 sm:py-24" aria-labelledby="reviews-heading">
          <Reveal variant="focus" stagger={90} className="flex flex-wrap items-end justify-between gap-6">
            <h2 id="reviews-heading" className="display text-4xl sm:text-5xl">
              Drivers on the {group.hero.name}
            </h2>
            <Link to={`/cars/${group.hero._id}#reviews`} className="btn-line">
              {group.hero.averageRating} from {group.hero.totalReviews} reviews <ArrowRight className="w-4 h-4" />
            </Link>
          </Reveal>
          <Reveal className="mt-10 grid gap-6 md:grid-cols-3">
            {reviews.slice(0, 3).map((r) => (
              <figure key={r._id} className="flex flex-col rounded-chip border border-line p-7">
                <StarRating value={r.rating} size="sm" />
                <blockquote className="mt-5 flex-1 text-lg leading-snug">{r.reviewText || 'Rated without a written review.'}</blockquote>
                <figcaption className="mt-6 text-sm">
                  <span className="font-semibold">{r.user?.name || 'Driveaway driver'}</span>
                  <span className="text-muted"> · {new Date(r.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                </figcaption>
              </figure>
            ))}
          </Reveal>
        </section>
      )}

      {/* ─────────────── Close: hubs on the paint ─────────────── */}
      <section style={paintStyle(selected)} className="lacquer on-paint" aria-labelledby="hubs-heading">
        <div className="page-container grid gap-12 py-20 sm:py-24 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <m.h2
              ref={closeRef}
              id="hubs-heading"
              style={{ scale: closeDrift.scale, opacity: closeDrift.opacity, transformOrigin: 'left bottom' }}
              className="display text-[clamp(2.4rem,5vw,4.5rem)]"
            >
              Your {paint.name} is waiting.
            </m.h2>
            <p className="mt-5 max-w-sm text-lg">Collect it from any of eight hubs across Ahmedabad.</p>
            <Link to={`/fleet?type=${selected}`} className="btn mt-8 !bg-on-paint !text-paint !px-8 !py-4 text-base hover:!shadow-lift">
              Book {pluralLower(selected)} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <Reveal as="ul" variant="slide" className="grid content-start gap-x-8 sm:grid-cols-2 lg:col-span-7">
            {HUBS.map((h) => (
              <li key={h} className="border-b border-on-paint/35">
                <Link
                  to={`/fleet?type=${selected}&location=${encodeURIComponent(h)}`}
                  className="group flex items-center justify-between gap-3 py-4 font-semibold"
                >
                  <span className="flex items-center gap-2.5"><MapPin className="h-4 w-4" />{h}</span>
                  <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </Reveal>
        </div>
      </section>
    </div>
  );
}
