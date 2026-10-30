import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Filter, X, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import api from '../api/axios';
import CarCard from '../components/cars/CarCard';
import PageWrapper from '../components/layout/PageWrapper';
import Spinner from '../components/ui/Spinner';

const TYPES = ['All', 'Hypercar', 'Supercar', 'Sports', 'Luxury', 'SUV', 'Sedan', 'Electric', 'Hatchback'];
const FUELS = ['All', 'Petrol', 'Diesel', 'Electric', 'Hybrid'];
const TRANSMISSIONS = ['All', 'Manual', 'Automatic'];
const SORTS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Best Rated' },
];

export default function FleetPage() {
  const [searchParams] = useSearchParams();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCars, setTotalCars] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [filters, setFilters] = useState({
    type: searchParams.get('type') || 'All',
    fuelType: 'All',
    transmission: 'All',
    minPrice: '',
    maxPrice: '',
    sort: 'newest',
    page: 1,
  });

  useEffect(() => {
    fetchCars();
  }, [filters]);

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


  const fetchCars = async () => {
    setLoading(true);
    try {
      const params = { page: filters.page, limit: 9, sort: filters.sort };
      if (filters.type !== 'All') params.type = filters.type;
      if (filters.fuelType !== 'All') params.fuelType = filters.fuelType;
      if (filters.transmission !== 'All') params.transmission = filters.transmission;
      if (filters.minPrice) params.minPrice = filters.minPrice;
      if (filters.maxPrice) params.maxPrice = filters.maxPrice;

      const { data } = await api.get('/cars', { params });
      setCars(data.cars || []);
      setTotalPages(data.totalPages || 1);
      setTotalCars(data.totalCars || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({ type: 'All', fuelType: 'All', transmission: 'All', minPrice: '', maxPrice: '', sort: 'newest', page: 1 });
  };

  const inputClass = 'w-full bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none';

  const FilterPanel = () => (
    <div className="space-y-6">
      {/* Type */}
      <div>
        <h3 className="text-gray-900 dark:text-white font-bold text-xs uppercase tracking-wider mb-3">Car Type</h3>
        <div className="flex flex-wrap gap-2">
          {TYPES.map(t => (
            <button
              key={t}
              onClick={() => updateFilter('type', t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filters.type === t
                  ? 'bg-amber-500 border-amber-500 text-black shadow-sm'
                  : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-amber-500 hover:text-amber-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {/* Fuel */}
      <div>
        <h3 className="text-gray-900 dark:text-white font-bold text-xs uppercase tracking-wider mb-3">Fuel Type</h3>
        <div className="flex flex-wrap gap-2">
          {FUELS.map(f => (
            <button
              key={f}
              onClick={() => updateFilter('fuelType', f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filters.fuelType === f
                  ? 'bg-amber-500 border-amber-500 text-black shadow-sm'
                  : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-amber-500 hover:text-amber-500'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      {/* Transmission */}
      <div>
        <h3 className="text-gray-900 dark:text-white font-bold text-xs uppercase tracking-wider mb-3">Transmission</h3>
        <div className="flex flex-wrap gap-2">
          {TRANSMISSIONS.map(t => (
            <button
              key={t}
              onClick={() => updateFilter('transmission', t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filters.transmission === t
                  ? 'bg-amber-500 border-amber-500 text-black shadow-sm'
                  : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-amber-500 hover:text-amber-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {/* Price Range */}
      <div>
        <h3 className="text-gray-900 dark:text-white font-bold text-xs uppercase tracking-wider mb-3">Price Range (₹/day)</h3>
        <div className="flex gap-2">
          <input type="number" placeholder="Min" value={filters.minPrice} onChange={e => updateFilter('minPrice', e.target.value)} className={inputClass} />
          <input type="number" placeholder="Max" value={filters.maxPrice} onChange={e => updateFilter('maxPrice', e.target.value)} className={inputClass} />
        </div>
      </div>
      {/* Clear */}
      <button
        onClick={clearFilters}
        className="w-full flex items-center justify-center gap-2 border border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl py-2.5 text-xs font-bold transition-colors"
      >
        <X className="w-4 h-4" /> Clear All Filters
      </button>
    </div>
  );

  return (
    <PageWrapper>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0D0D0D] text-gray-900 dark:text-white pt-20 transition-colors">
        {/* Header */}
        <div className="bg-white dark:bg-[#111] border-b border-gray-200 dark:border-white/[0.06] py-8 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Our Fleet</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{totalCars} verified vehicles available in Ahmedabad</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={filters.sort}
                onChange={e => updateFilter('sort', e.target.value)}
                className="bg-white dark:bg-[#1A1A1A] border border-gray-300 dark:border-white/10 rounded-xl px-3.5 py-2 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              >
                {SORTS.map(s => (
                  <option key={s.value} value={s.value} className="bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white">
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="md:hidden flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl px-4 py-2 text-sm shadow-sm"
              >
                <SlidersHorizontal className="w-4 h-4" /> Filters
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex gap-8">
            {/* Desktop Sidebar */}
            <aside className="hidden md:block w-64 flex-shrink-0">
              <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-6 sticky top-24 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-gray-900 dark:text-white font-bold text-base flex items-center gap-2">
                    <Filter className="w-4 h-4 text-amber-500" /> Filters
                  </h2>
                </div>
                <FilterPanel />
              </div>
            </aside>

            {/* Mobile Filters Drawer */}
            {filtersOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 md:hidden"
              >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setFiltersOpen(false)} />
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  className="absolute left-0 top-0 bottom-0 w-80 bg-white dark:bg-[#161616] p-6 overflow-y-auto shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-5 border-b border-gray-100 dark:border-white/10 pb-3">
                    <h2 className="text-gray-900 dark:text-white font-bold text-base">Filters</h2>
                    <button onClick={() => setFiltersOpen(false)}>
                      <X className="w-5 h-5 text-gray-500 hover:text-gray-900 dark:hover:text-white" />
                    </button>
                  </div>
                  <FilterPanel />
                </motion.div>
              </motion.div>
            )}

            {/* Car Grid */}
            <main className="flex-1">
              {loading ? (
                <div className="flex justify-center py-20"><Spinner size="lg" /></div>
              ) : cars.length === 0 ? (
                <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-12 text-center shadow-sm">
                  <div className="text-6xl mb-4">🚗</div>
                  <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-2">No Cars Found</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Try adjusting your filters to see more results</p>
                  <button onClick={clearFilters} className="text-amber-500 hover:text-amber-400 font-bold text-sm">
                    Clear all filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {cars.map((car, i) => <CarCard key={car._id} car={car} index={i} />)}
                  </div>
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-10">
                      <button
                        disabled={filters.page <= 1}
                        onClick={() => setFilters(p => ({ ...p, page: p.page - 1 }))}
                        className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:border-amber-500 hover:text-amber-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      {[...Array(totalPages)].map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setFilters(p => ({ ...p, page: i + 1 }))}
                          className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                            filters.page === i + 1
                              ? 'bg-amber-500 text-black shadow-sm'
                              : 'bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-amber-500 hover:text-amber-500'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                      <button
                        disabled={filters.page >= totalPages}
                        onClick={() => setFilters(p => ({ ...p, page: p.page + 1 }))}
                        className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:border-amber-500 hover:text-amber-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </main>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
