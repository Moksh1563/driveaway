import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, SlidersHorizontal, Search, MapPin, CalendarDays } from 'lucide-react';
import api from '../api/axios';
import CarCard from '../components/cars/CarCard';
import { PAINTS, PAINT_ORDER, paintFor, paintStyle, plural, rupees } from '../theme/paints';
import Reveal from '../components/ui/Reveal';
import { CarGridSkeleton } from '../components/ui/Skeletons';
import { sheetMotion, sheetScrimMotion } from '../theme/motion';
import useFocusTrap from '../hooks/useFocusTrap';
import useDebounced from '../hooks/useDebounced';

const TYPES = ['All', ...PAINT_ORDER];
const FUELS = ['All', 'Petrol', 'Diesel', 'Electric', 'Hybrid'];
const TRANSMISSIONS = ['All', 'Manual', 'Automatic'];
const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price, low to high' },
  { value: 'price_desc', label: 'Price, high to low' },
  { value: 'rating', label: 'Best rated' },
];
const SORT_VALUES = SORTS.map((s) => s.value);

// Filters live in the URL (so Back from a car, a bookmark or a shared link restores them).
// Filter key -> search param name; defaults are left out of the URL.
const PARAM = { type: 'type', fuelType: 'fuel', transmission: 'gearbox', minPrice: 'min', maxPrice: 'max', search: 'search', sort: 'sort', page: 'page' };
const DEFAULTS = { type: 'All', fuelType: 'All', transmission: 'All', minPrice: '', maxPrice: '', search: '', sort: 'newest', page: 1 };

/** Read the filters from the URL, ignoring anything unknown or malformed. */
function readFilters(params) {
  const pick = (key, allowed) => (allowed.includes(params.get(PARAM[key])) ? params.get(PARAM[key]) : DEFAULTS[key]);
  const amount = (key) => {
    const v = (params.get(PARAM[key]) || '').trim();
    return /^\d+$/.test(v) ? v : '';
  };
  const page = parseInt(params.get(PARAM.page), 10);
  return {
    type: pick('type', TYPES),
    fuelType: pick('fuelType', FUELS),
    transmission: pick('transmission', TRANSMISSIONS),
    minPrice: amount('minPrice'),
    maxPrice: amount('maxPrice'),
    search: (params.get(PARAM.search) || '').trim(),
    sort: pick('sort', SORT_VALUES),
    page: page > 0 ? page : 1,
  };
}

// Trip dates arrive as YYYY-MM-DD (read as UTC midnight), so format them in UTC to keep the day
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export default function FleetPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Trip details carried over from the home page order slip; booking pre-fills from these
  const trip = {
    location: searchParams.get('location') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  };
  useEffect(() => {
    if (trip.location || trip.from || trip.to) {
      try { sessionStorage.setItem('driveaway_trip', JSON.stringify(trip)); } catch { /* storage unavailable */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.location, trip.from, trip.to]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCars, setTotalCars] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const sheetRef = useRef(null);

  const filters = useMemo(() => readFilters(searchParams), [searchParams]);

  /** Write filter changes to the URL. Replace, not push: Back leaves the fleet instead of undoing a filter. */
  const setParams = useCallback((changes) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === null || value === '' || value === DEFAULTS[key]) next.delete(PARAM[key]);
        else next.set(PARAM[key], String(value));
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  // setSearchParams changes identity with every URL change; effects below must run only when
  // their own inputs change, so they call the latest one through a ref
  const setParamsRef = useRef(setParams);
  useEffect(() => { setParamsRef.current = setParams; }, [setParams]);

  // Text inputs are kept separately and debounced before they reach the URL (and the API)
  const [searchText, setSearchText] = useState(filters.search);
  const [priceInput, setPriceInput] = useState({ min: filters.minPrice, max: filters.maxPrice });
  const debouncedSearch = useDebounced(searchText.trim());
  const debouncedPrice = useDebounced(priceInput);
  // What the text inputs last wrote to the URL, to tell our own writes from outside changes
  const written = useRef({ search: filters.search, min: filters.minPrice, max: filters.maxPrice });

  // The URL changed from outside (a link to /fleet, Clear all): bring the text inputs along
  useEffect(() => {
    const w = written.current;
    if (filters.search !== w.search) setSearchText(filters.search);
    if (filters.minPrice !== w.min || filters.maxPrice !== w.max) setPriceInput({ min: filters.minPrice, max: filters.maxPrice });
    written.current = { search: filters.search, min: filters.minPrice, max: filters.maxPrice };
  }, [filters.search, filters.minPrice, filters.maxPrice]);

  // Debounced text fields feed into the URL (and reset to page 1)
  useEffect(() => {
    const w = written.current;
    if (debouncedSearch === w.search && debouncedPrice.min === w.min && debouncedPrice.max === w.max) return;
    written.current = { search: debouncedSearch, min: debouncedPrice.min, max: debouncedPrice.max };
    setParamsRef.current({ search: debouncedSearch, minPrice: debouncedPrice.min, maxPrice: debouncedPrice.max, page: null });
  }, [debouncedSearch, debouncedPrice]);

  // Fetch cars whenever filters change; abort stale requests so results never arrive out of order
  useEffect(() => {
    const controller = new AbortController();
    const fetchCars = async () => {
      setLoading(true);
      setError('');
      try {
        const params = { page: filters.page, limit: 9, sort: filters.sort };
        if (filters.type !== 'All') params.type = filters.type;
        if (filters.fuelType !== 'All') params.fuelType = filters.fuelType;
        if (filters.transmission !== 'All') params.transmission = filters.transmission;
        if (filters.minPrice) params.minPrice = filters.minPrice;
        if (filters.maxPrice) params.maxPrice = filters.maxPrice;
        if (filters.search) params.search = filters.search;

        const { data } = await api.get('/cars', { params, signal: controller.signal });
        const pages = data.totalPages || 1;
        // A bookmarked or shared link can point past the last page once the fleet shrinks
        if (filters.page > pages && (data.totalCars || 0) > 0) {
          setParamsRef.current({ page: pages });
          return;
        }
        setCars(data.cars || []);
        setTotalPages(pages);
        setTotalCars(data.totalCars || 0);
        setLoading(false);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err.response?.data?.message || 'Could not load cars.');
        setLoading(false);
      }
    };
    fetchCars();
    return () => controller.abort();
  }, [filters, reloadKey]);

  const updateFilter = (key, value) => setParams({ [key]: value, page: null });

  // Clears the filters and sort; the trip details (hub, dates) carried from the home page stay
  const clearFilters = () => setParams({ type: null, fuelType: null, transmission: null, minPrice: null, maxPrice: null, search: null, sort: null, page: null });

  const goToPage = (page) => {
    setParams({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Mobile filter sheet: a real dialog (focus moves in and stays, Escape closes, focus returns)
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  useFocusTrap(sheetRef, filtersOpen, { onEscape: closeFilters });
  useEffect(() => {
    if (!filtersOpen) return undefined;
    // The sheet only exists below the md breakpoint: close it if the window grows past it
    const wide = window.matchMedia('(min-width: 768px)');
    if (wide.matches) { setFiltersOpen(false); return undefined; }
    const onChange = (e) => { if (e.matches) setFiltersOpen(false); };
    wide.addEventListener?.('change', onChange);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      wide.removeEventListener?.('change', onChange);
      document.body.style.overflow = prev;
    };
  }, [filtersOpen]);

  const activeFilterCount =
    (filters.type !== 'All') + (filters.fuelType !== 'All') + (filters.transmission !== 'All') +
    Boolean(filters.minPrice || filters.maxPrice) + Boolean(filters.search);

  const typeSel = filters.type !== 'All' ? filters.type : null;
  const paint = typeSel ? paintFor(typeSel) : null;
  const rates = cars.map((c) => c.dailyRate);
  const span = rates.length ? [Math.min(...rates), Math.max(...rates)] : null;

  const pill = (active) =>
    `rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
      active ? 'border-ink bg-ink text-ground' : 'border-line text-ink hover:border-ink'
    }`;

  // A render function, not a nested component: a nested component would remount on every
  // render and the price inputs would lose focus after each keystroke.
  const renderFilterPanel = () => (
    <div className="space-y-8">
      <fieldset>
        <legend className="field-label">Fuel</legend>
        <div className="flex flex-wrap gap-2">
          {FUELS.map((f) => (
            <button key={f} type="button" aria-pressed={filters.fuelType === f} onClick={() => updateFilter('fuelType', f)} className={pill(filters.fuelType === f)}>
              {f}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="field-label">Gearbox</legend>
        <div className="flex flex-wrap gap-2">
          {TRANSMISSIONS.map((t) => (
            <button key={t} type="button" aria-pressed={filters.transmission === t} onClick={() => updateFilter('transmission', t)} className={pill(filters.transmission === t)}>
              {t}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="field-label">Daily rate (₹)</legend>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" inputMode="numeric" min="0" placeholder="Min" aria-label="Minimum price per day" value={priceInput.min} onChange={(e) => setPriceInput((p) => ({ ...p, min: e.target.value }))} className="field" />
          <input type="number" inputMode="numeric" min="0" placeholder="Max" aria-label="Maximum price per day" value={priceInput.max} onChange={(e) => setPriceInput((p) => ({ ...p, max: e.target.value }))} className="field" />
        </div>
      </fieldset>
      {activeFilterCount > 0 && (
        <button type="button" onClick={clearFilters} className="btn-line w-full">
          <X className="w-4 h-4" /> Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className="pt-[72px]">
      {/* Head: wears the selected paint, or primer when showing everything */}
      <header style={typeSel ? paintStyle(typeSel) : undefined} className={`transition-[background-color,color] duration-300 ease-in-out ${typeSel ? 'lacquer on-paint' : 'border-b border-line'}`}>
        <div className="page-container pt-12 pb-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="display text-[clamp(2.8rem,7vw,5.5rem)]">{typeSel ? plural(typeSel) : 'The fleet'}</h1>
              <p className={`mt-3 ${typeSel ? '' : 'text-muted'}`} aria-live="polite">
                {loading
                  ? 'Loading cars…'
                  : `${totalCars} ${totalCars === 1 ? 'car' : 'cars'}${typeSel ? ` in ${paint.name}` : ' across eight factory paints'}${activeFilterCount > (typeSel ? 1 : 0) ? ', matching your filters' : ''}.`}
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
              <label className="relative basis-full sm:basis-auto sm:w-72">
                <span className="sr-only">Search cars</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input type="search" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search make, model or type" className="field !rounded-full !pl-11" />
              </label>
              <select aria-label="Sort cars" value={filters.sort} onChange={(e) => updateFilter('sort', e.target.value)} className="field !w-auto flex-1 !rounded-full sm:flex-none">
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <button type="button" onClick={() => setFiltersOpen(true)} className="btn-ink md:hidden">
                <SlidersHorizontal className="w-4 h-4" /> Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
              </button>
            </div>
          </div>

          {/* Head rule: trip context and the price span currently in view */}
          <div className={`mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-4 code-label text-[12px] ${typeSel ? 'border-on-paint/30' : 'border-line text-muted'}`}>
            <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {trip.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Collect at {trip.location}</span>}
              {trip.from && trip.to && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {fmtDate(trip.from)} to {fmtDate(trip.to)}</span>}
              {!trip.location && !(trip.from && trip.to) && <span>{typeSel ? `Paint ${paint.no} · ${paint.name}` : 'Every category has its own paint'}</span>}
            </span>
            {span && !loading && <span>In view: {rupees(span[0])} to {rupees(span[1])} a day</span>}
          </div>
        </div>
      </header>

      {/* Paint book: category filter */}
      <nav aria-label="Category" className="border-b border-line bg-ground">
        <div className="page-container">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-4 sm:mx-0 sm:px-0 [scrollbar-width:none]">
            {TYPES.map((t) => {
              const active = filters.type === t;
              const p = PAINTS[t];
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  onClick={() => updateFilter('type', t)}
                  style={p ? paintStyle(t) : undefined}
                  className={`flex flex-shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
                    active ? (p ? 'lacquer border-transparent' : 'border-ink bg-ink text-ground') : 'border-line hover:border-ink'
                  }`}
                >
                  {p && <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: p.hex }} aria-hidden="true" />}
                  {t === 'All' ? 'All paints' : t}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="page-container py-10">
        <div className="flex gap-10">
          <aside className="hidden w-60 flex-shrink-0 md:block" aria-label="Filters">
            <div className="sticky top-[96px]">{renderFilterPanel()}</div>
          </aside>

          <AnimatePresence>
            {filtersOpen && (
              <m.div {...sheetScrimMotion} className="fixed inset-0 z-[60] md:hidden">
                <div className="absolute inset-0 bg-[#0C0C0D]/60" onClick={closeFilters} aria-hidden="true" />
                <m.div
                  ref={sheetRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="filters-sheet-title"
                  {...sheetMotion}
                  className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[24px] border-t border-line bg-surface p-6 focus:outline-none"
                >
                  <div className="mb-6 flex items-center justify-between">
                    <h2 id="filters-sheet-title" className="font-wide font-black uppercase tracking-tight text-xl">Filters</h2>
                    <button type="button" onClick={closeFilters} aria-label="Close filters" className="grid h-10 w-10 place-items-center rounded-full border border-line">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  {renderFilterPanel()}
                  <button type="button" onClick={closeFilters} className="btn-ink mt-6 w-full !py-4">
                    Show {totalCars} {totalCars === 1 ? 'car' : 'cars'}
                  </button>
                </m.div>
              </m.div>
            )}
          </AnimatePresence>

          <section className="min-w-0 flex-1" aria-label="Cars" aria-busy={loading}>
            {/* Skeleton only on the first load; on later filter changes the last results stay
                (dimmed) until the new ones arrive, so the grid never blanks or replays its entrance */}
            {loading && cars.length === 0 ? (
              <CarGridSkeleton />
            ) : error ? (
              <div className="rounded-chip border border-line p-12 text-center">
                <h2 className="font-wide font-black uppercase text-xl">Could not load the fleet</h2>
                <p className="mt-2 text-muted">{error}</p>
                <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="btn-ink mt-6">Try again</button>
              </div>
            ) : cars.length === 0 ? (
              <div className="rounded-chip border border-dashed border-line p-12 text-center">
                <h2 className="font-wide font-black uppercase text-xl">No cars match</h2>
                <p className="mt-2 text-muted">Try another paint, or widen the price range.</p>
                <button type="button" onClick={clearFilters} className="btn-ink mt-6">Clear all filters</button>
              </div>
            ) : (
              <>
                <Reveal
                  wrap
                  cellClassName="h-full"
                  className={`grid grid-cols-1 gap-6 transition-opacity duration-150 ease-out sm:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-60' : ''}`}
                >
                  {cars.map((car, i) => <CarCard key={car._id} car={car} index={i} />)}
                </Reveal>
                {totalPages > 1 && (
                  <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Pages">
                    <button type="button" disabled={filters.page <= 1} onClick={() => goToPage(filters.page - 1)} aria-label="Previous page" className="grid h-11 w-11 place-items-center rounded-full border border-line hover:border-ink disabled:opacity-30">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => goToPage(i + 1)}
                        aria-current={filters.page === i + 1 ? 'page' : undefined}
                        className={`grid h-11 w-11 place-items-center rounded-full text-sm font-bold ${filters.page === i + 1 ? 'bg-ink text-ground' : 'border border-line hover:border-ink'}`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button type="button" disabled={filters.page >= totalPages} onClick={() => goToPage(filters.page + 1)} aria-label="Next page" className="grid h-11 w-11 place-items-center rounded-full border border-line hover:border-ink disabled:opacity-30">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </nav>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
