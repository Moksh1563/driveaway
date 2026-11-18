import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, SlidersHorizontal, Search, MapPin, CalendarDays } from 'lucide-react';
import api from '../api/axios';
import CarCard from '../components/cars/CarCard';
import { PAINTS, PAINT_ORDER, paintFor, paintStyle, plural, rupees } from '../theme/paints';

const TYPES = ['All', ...PAINT_ORDER];
const FUELS = ['All', 'Petrol', 'Diesel', 'Electric', 'Hybrid'];
const TRANSMISSIONS = ['All', 'Manual', 'Automatic'];
const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price, low to high' },
  { value: 'price_desc', label: 'Price, high to low' },
  { value: 'rating', label: 'Best rated' },
];

/** Debounce a fast-changing value (typing) so we don't hit the API on every keystroke. */
function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function CarCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-chip border border-line bg-raised" aria-hidden="true">
      <div className="skeleton aspect-[16/10] rounded-none" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-3 w-1/4" />
        <div className="flex justify-between gap-4"><div className="skeleton h-5 w-2/3" /><div className="skeleton h-5 w-16" /></div>
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-11 w-full" />
      </div>
    </div>
  );
}

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function FleetPage() {
  const [searchParams] = useSearchParams();
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
  // Text inputs are kept separately and debounced before they reach the API
  const [searchText, setSearchText] = useState(searchParams.get('search') || '');
  const [priceInput, setPriceInput] = useState({ min: '', max: '' });
  const debouncedSearch = useDebounced(searchText.trim());
  const debouncedPrice = useDebounced(priceInput);

  const [filters, setFilters] = useState({
    type: searchParams.get('type') || 'All',
    fuelType: 'All',
    transmission: 'All',
    minPrice: '',
    maxPrice: '',
    search: searchParams.get('search') || '',
    sort: 'newest',
    page: 1,
  });

  // Debounced text fields feed into the filters (and reset to page 1)
  useEffect(() => {
    setFilters(prev => (
      prev.minPrice === debouncedPrice.min && prev.maxPrice === debouncedPrice.max && prev.search === debouncedSearch
        ? prev
        : { ...prev, minPrice: debouncedPrice.min, maxPrice: debouncedPrice.max, search: debouncedSearch, page: 1 }
    ));
  }, [debouncedPrice, debouncedSearch]);

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
        setCars(data.cars || []);
        setTotalPages(data.totalPages || 1);
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

  // Synchronize filters when URL search parameters change (e.g. from homepage search or category links)
  useEffect(() => {
    const urlType = searchParams.get('type') || 'All';
    setFilters(prev => {
      if (prev.type !== urlType) {
        return { ...prev, type: urlType, page: 1 };
      }
      return prev;
    });
  }, [searchParams]);


  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const clearFilters = () => {
    setSearchText('');
    setPriceInput({ min: '', max: '' });
    setFilters({ type: 'All', fuelType: 'All', transmission: 'All', minPrice: '', maxPrice: '', search: '', sort: 'newest', page: 1 });
  };

  const goToPage = (page) => {
    setFilters(p => ({ ...p, page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
      <header style={typeSel ? paintStyle(typeSel) : undefined} className={typeSel ? 'lacquer on-paint' : 'border-b border-line'}>
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Filters">
                <div className="absolute inset-0 bg-[#0C0C0D]/60" onClick={() => setFiltersOpen(false)} />
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'tween', duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[24px] border-t border-line bg-surface p-6"
                >
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="font-wide font-black uppercase tracking-tight text-xl">Filters</h2>
                    <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="grid h-10 w-10 place-items-center rounded-full border border-line">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  {renderFilterPanel()}
                  <button type="button" onClick={() => setFiltersOpen(false)} className="btn-ink mt-6 w-full !py-4">
                    Show {totalCars} {totalCars === 1 ? 'car' : 'cars'}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <section className="min-w-0 flex-1" aria-label="Cars" aria-busy={loading}>
            {loading ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {[...Array(6)].map((_, i) => <CarCardSkeleton key={i} />)}
              </div>
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
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {cars.map((car, i) => <CarCard key={car._id} car={car} index={i} />)}
                </div>
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
