import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, MapPin } from 'lucide-react';
import api from '../api/axios';
import CarCard from '../components/cars/CarCard';
import StarRating from '../components/ui/StarRating';
import Reveal from '../components/ui/Reveal';
import { HUBS } from '../theme/hubs';
import { PAINTS, PAINT_ORDER, carTitle, paintFor, paintStyle, plural, pluralLower, rupees } from '../theme/paints';
import { sizedImage, imageSrcSet, handleImageError } from '../utils/image';
import { CarGridSkeleton } from '../components/ui/Skeletons';
import { EASE } from '../theme/motion';


const today = () => new Date().toISOString().split('T')[0];

export default function HomePage() {
  const navigate = useNavigate();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paintType, setPaintType] = useState('Hypercar'); // paint currently on the hero ground
  const [selected, setSelected] = useState('Hypercar');   // paint the visitor picked (content follows instantly)
  const [wipe, setWipe] = useState(null);                  // { type, x, key } while the new paint sweeps in
  const [slip, setSlip] = useState({ location: '', from: '', to: '' });
  const [reviews, setReviews] = useState([]);
  const fanRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/cars', { params: { limit: 100, sort: 'rating' } })
      .then(({ data }) => { if (!cancelled) setCars(data.cars || []); })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  // Group the real fleet by category, in paint-book order
  const book = useMemo(() => {
    const groups = PAINT_ORDER.map((type) => {
      // Cars ready to drive first, then the ones out on the road
      const list = cars.filter((c) => c.type === type).sort((a, b) => (a.status === 'Available' ? 0 : 1) - (b.status === 'Available' ? 0 : 1));
      const ready = list.filter((c) => c.status === 'Available');
      return {
        type,
        list,
        ready,
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

  const heroImg = group?.hero?.images?.main;

  useEffect(() => {
    const row = fanRef.current;
    const chip = row?.querySelector('[aria-checked="true"]')?.parentElement; // the chip's wrapper
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return;
    const target = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [selected, book.length]);
  const heroId = group?.hero?._id;

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

        <div className="page-container relative pt-6 pb-36 lg:pt-8">
          {/* Headline: full width, sized so its longest line always fits */}
          <div style={{ containerType: 'inline-size' }}>
            <h1
              key={selected}
              className="display"
              style={{ fontSize: `min(5rem, calc(100cqw / ${headlineChars * 0.86}))` }}
            >
              <span className="mask-line"><span style={{ '--i': 0 }}>{plural(selected)},</span></span>
              <span className="mask-line"><span style={{ '--i': 1 }}>in {paint.name}.</span></span>
            </h1>
          </div>

          <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-12 lg:gap-10">
          <Reveal className="lg:col-span-5 flex flex-col" delay={250} stagger={90}>
            <p className="max-w-md text-lg leading-snug">
              Hypercars, supercars and luxury cars for hire in Ahmedabad. Pick a paint, pick your dates, collect the keys.
            </p>
            <p className="mt-4 code-label text-[13px]">
              Paint {paint.no}
              {group ? ` · ${group.list.length} ${group.list.length === 1 ? 'car' : 'cars'} · from ${rupees(group.from)} a day` : ''}
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
                    {(book.length ? book.map((g) => g.type) : PAINT_ORDER.slice(0, 5)).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="field-label">From</span>
                  <input
                    type="date"
                    min={today()}
                    value={slip.from}
                    onChange={(e) => setSlip((s) => ({ ...s, from: e.target.value, to: s.to && s.to <= e.target.value ? '' : s.to }))}
                    className="field"
                  />
                </label>
                <label>
                  <span className="field-label">To</span>
                  <input
                    type="date"
                    min={slip.from || today()}
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
              <AnimatePresence initial={false}>
                <motion.img
                  key={heroImg || 'hero'}
                  initial={{ opacity: 0, scale: 1.03 }}
                  animate={{ opacity: 1, scale: 1, transition: { duration: 0.3, delay: 0.22, ease: EASE.out } }}
                  exit={{ opacity: 0, transition: { duration: 0.22, delay: 0.22, ease: EASE.in } }}
                  src={heroImg ? sizedImage(heroImg, 1400, 75) : '/images/luxury_hypercars_header.webp'}
                  srcSet={heroImg ? imageSrcSet(heroImg, [800, 1200, 1600]) : undefined}
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  alt={group?.hero ? carTitle(group.hero) : 'Driveaway hypercars'}
                  fetchpriority="high"
                  onError={(e) => handleImageError(e, 1200)}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </AnimatePresence>
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

        {/* Swatch fan: the paint book. Choosing a chip repaints the page. */}
        <div className="absolute inset-x-0 bottom-0">
          <div className="page-container">
            <div
              ref={fanRef}
              role="radiogroup"
              aria-label="Choose a category"
              className="-mx-4 flex items-end overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 pt-8 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {(book.length ? book : PAINT_ORDER.slice(0, 5).map((type) => ({ type, list: [] }))).map((g, i, all) => {
                const p = PAINTS[g.type];
                const active = g.type === selected;
                const activeIndex = all.findIndex((x) => x.type === selected);
                const tilt = active ? 0 : (i < activeIndex ? -1 : 1) * (2 + Math.min(Math.abs(i - activeIndex), 3));
                return (
                  <div
                    key={g.type}
                    className={`enter-deal flex-shrink-0 ${i > 0 ? '-ml-2' : ''}`}
                    style={{ '--d': `${450 + i * 70}ms`, '--tilt': `${(i % 2 ? 1 : -1) * 4}deg`, zIndex: 20 - Math.abs(i - activeIndex), position: 'relative' }}
                  >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={(e) => choose(g.type, e)}
                    style={{
                      ...paintStyle(g.type),
                      transform: `translateY(${active ? -14 : 10}px) rotate(${tilt}deg)`,
                      transformOrigin: 'bottom center',
                    }}
                    className={`lacquer relative flex h-32 w-[150px] flex-shrink-0 flex-col justify-between rounded-t-[18px] border border-b-0 border-white/25 pl-5 pr-4 pt-3.5 pb-7 text-left shadow-chip transition-transform duration-300 ease-in-out sm:w-[172px]`}
                  >
                    <span className="code-label text-[11px]">Paint {p.no}</span>
                    <span>
                      <span className="block font-wide font-black uppercase leading-none tracking-tight text-[17px]">{g.type}</span>
                      <span className="mt-1 block text-xs">
                        {p.name}{g.list.length ? ` · ${g.list.length}` : ''}
                      </span>
                    </span>
                    {active && <span className="absolute right-3.5 top-3.5 h-2.5 w-2.5 rounded-full bg-on-paint" aria-hidden="true" />}
                  </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── The cars in this paint ─────────────── */}
      <section style={paintStyle(selected)} className="page-container py-20 sm:py-24" aria-labelledby="line-heading">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-6">
          <div>
            <h2 id="line-heading" className="display text-4xl sm:text-5xl">
              {group ? `${group.ready.length} ready to drive` : 'The fleet'}
            </h2>
            <p className="mt-3 text-muted">
              {plural(selected)} in {paint.name}
              {group && group.list.length > group.ready.length ? `, plus ${group.list.length - group.ready.length} out on the road` : ''}.
            </p>
          </div>
          <Link to={`/fleet?type=${selected}`} className="btn-line">
            All {pluralLower(selected)} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <CarGridSkeleton count={3} className="mt-10" />
        ) : (
          <Reveal wrap cellClassName="h-full" className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {(group?.list || []).slice(0, 6).map((car, i) => <CarCard key={car._id} car={car} index={i} />)}
          </Reveal>
        )}
      </section>

      {/* ─────────────── How a booking goes: the axis itself, paint to car to keys ─────────────── */}
      <section className="border-y border-line bg-surface" aria-labelledby="how-heading">
        <div className="page-container py-20 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 id="how-heading" className="display text-4xl sm:text-5xl">Paint, car, keys.</h2>
            <p className="max-w-sm text-muted">
              Booking takes about two minutes. Pay online now, or pay in cash when you collect the car.
            </p>
          </div>
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
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 id="reviews-heading" className="display text-4xl sm:text-5xl">
              Drivers on the {group.hero.name}
            </h2>
            <Link to={`/cars/${group.hero._id}#reviews`} className="btn-line">
              {group.hero.averageRating} from {group.hero.totalReviews} reviews <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
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
            <h2 id="hubs-heading" className="display text-[clamp(2.4rem,5vw,4.5rem)]">
              Your {paint.name} is waiting.
            </h2>
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
