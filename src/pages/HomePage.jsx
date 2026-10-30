import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Car, ChevronRight, Star, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import api from '../api/axios';
import CarCard from '../components/cars/CarCard';
import PageWrapper from '../components/layout/PageWrapper';
import Spinner from '../components/ui/Spinner';
import DiscountBanner from '../components/discounts/DiscountBanner';


const LOCATIONS = ['SG Highway', 'Vastrapur', 'Bopal', 'Ashram Road', 'Ahmedabad Airport', 'BRTS Bus Stand'];
const CAR_TYPES = ['All', 'Hypercar', 'Supercar', 'Sports', 'Luxury', 'SUV', 'Sedan', 'Electric', 'Hatchback'];

const TESTIMONIALS = [
  { name: 'Priya Sharma', location: 'Vastrapur', rating: 5, text: 'Absolutely amazing service! Booked a BMW 3 Series for my anniversary and it was spotless. The process was so smooth. Driveaway is hands down the best in Ahmedabad!' },
  { name: 'Rahul Patel', location: 'SG Highway', rating: 5, text: 'Rented the Nissan GT-R for a weekend. Pure adrenaline! Great condition, professional staff, and competitive pricing. Will definitely be back.' },
  { name: 'Anjali Mehta', location: 'Bopal', rating: 4, text: 'The Hyundai Creta was perfect for our family trip to Gir. Clean, fuel-efficient, and pickup from Bopal was super convenient. Highly recommended!' },
];

const HOW_IT_WORKS = [
  { icon: Car, title: 'Choose Your Car', desc: 'Browse our premium fleet of 50+ vehicles. Filter by type, budget, and availability.' },
  { icon: Calendar, title: 'Book & Confirm', desc: 'Select your dates, pickup location, and confirm your booking in under 2 minutes.' },
  { icon: MapPin, title: 'Drive Away', desc: 'Pick up your car from any of our 8 Ahmedabad locations and hit the road!' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [featuredCars, setFeaturedCars] = useState([]);
  const [loadingCars, setLoadingCars] = useState(true);
  const [searchForm, setSearchForm] = useState({
    location: '',
    from: '',
    to: '',
    type: 'All',
  });

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const { data } = await api.get('/cars?limit=6&status=Available');
        setFeaturedCars(data.cars || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingCars(false);
      }
    };
    fetchFeatured();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchForm.location) params.set('location', searchForm.location);
    if (searchForm.from) params.set('from', searchForm.from);
    if (searchForm.to) params.set('to', searchForm.to);
    if (searchForm.type && searchForm.type !== 'All') params.set('type', searchForm.type);
    navigate(`/fleet?${params.toString()}`);
  };

  const inputClass = "w-full bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none";

  return (
    <PageWrapper>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0D0D0D] text-gray-900 dark:text-white transition-colors duration-200">

        {/* ─── HERO ─── */}
        <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-16">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/images/luxury_hypercars_header.jpg')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-gray-50 dark:to-[#0D0D0D]" />

          <div className="relative z-10 text-center px-4 max-w-4xl mx-auto py-16">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 backdrop-blur-md rounded-full px-4 py-1.5 mb-6">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span className="text-amber-300 text-sm font-semibold">Ahmedabad's #1 Premium Car Rental</span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-white leading-tight mb-6"
            >
              Drive Your{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-amber-300">
                Dreams
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-lg text-gray-200 max-w-xl mx-auto mb-8 leading-relaxed font-normal"
            >
              Experience luxury, performance, and freedom across Ahmedabad. 50+ premium verified cars. Book in minutes.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex items-center justify-center gap-4 flex-wrap"
            >
              <Link
                to="/fleet"
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full px-8 py-3.5 transition-all shadow-lg shadow-amber-500/30"
              >
                Explore Fleet <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/about"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold rounded-full px-8 py-3.5 transition-colors backdrop-blur-md"
              >
                How It Works
              </Link>
            </motion.div>

            {/* Stats strip */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-300 flex-wrap"
            >
              {[
                { val: '50+', label: 'Cars' },
                { val: '10K+', label: 'Happy Rides' },
                { val: '4.9★', label: 'Average Rating' },
                { val: '24/7', label: 'Local Support' },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-white font-bold text-xl">{s.val}</div>
                  <div className="text-xs text-gray-300">{s.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ─── QUICK SEARCH WIDGET ─── */}
        <section className="relative z-20 -mt-10 px-4">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-6 sm:p-7 shadow-2xl"
            >
              <h2 className="text-gray-900 dark:text-white font-bold text-lg mb-4 flex items-center gap-2">
                <Car className="w-5 h-5 text-amber-500" /> Find Your Perfect Car
              </h2>
              <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-700 dark:text-gray-400 font-semibold uppercase tracking-wider">Pickup Location</label>
                  <select
                    value={searchForm.location}
                    onChange={e => setSearchForm(p => ({ ...p, location: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="" className="bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white">Any Location</option>
                    {LOCATIONS.map(l => <option key={l} value={l} className="bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white">{l}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-700 dark:text-gray-400 font-semibold uppercase tracking-wider">Pickup Date</label>
                  <input
                    type="date"
                    value={searchForm.from}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setSearchForm(p => ({ ...p, from: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-700 dark:text-gray-400 font-semibold uppercase tracking-wider">Return Date</label>
                  <input
                    type="date"
                    value={searchForm.to}
                    min={searchForm.from || new Date().toISOString().split('T')[0]}
                    onChange={e => setSearchForm(p => ({ ...p, to: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-700 dark:text-gray-400 font-semibold uppercase tracking-wider">Car Type</label>
                  <div className="flex gap-2">
                    <select
                      value={searchForm.type}
                      onChange={e => setSearchForm(p => ({ ...p, type: e.target.value }))}
                      className={`${inputClass} flex-1`}
                    >
                      {CAR_TYPES.map(t => <option key={t} value={t} className="bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white">{t}</option>)}
                    </select>
                    <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl px-4 transition-colors flex items-center justify-center">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        </section>

        {/* ─── FEATURED FLEET ─── */}
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-end justify-between mb-10"
            >
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-0.5 bg-amber-500 rounded-full" />
                  <span className="text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">Premium Selection</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Featured Fleet</h2>
              </div>
              <Link to="/fleet" className="flex items-center gap-1 text-amber-500 hover:text-amber-400 text-sm font-bold transition-colors">
                View All Cars <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {loadingCars ? (
              <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredCars.map((car, i) => <CarCard key={car._id} car={car} index={i} />)}
              </div>
            )}
          </div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section className="py-20 px-4 bg-gray-100 dark:bg-[#111] transition-colors">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-14"
            >
              <div className="flex items-center justify-center gap-2.5 mb-2">
                <div className="w-8 h-0.5 bg-amber-500 rounded-full" />
                <span className="text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">Simple Process</span>
                <div className="w-8 h-0.5 bg-amber-500 rounded-full" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">How It Works</h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {HOW_IT_WORKS.map((step, i) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-7 text-center shadow-sm hover:shadow-md transition-all"
                >
                  <div className="w-14 h-14 bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                    <step.icon className="w-7 h-7 text-amber-500" />
                  </div>
                  <div className="text-amber-500 text-xs font-black uppercase tracking-wider mb-2">Step 0{i + 1}</div>
                  <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-2">{step.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── TESTIMONIALS ─── */}
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-14"
            >
              <div className="flex items-center justify-center gap-2.5 mb-2">
                <div className="w-8 h-0.5 bg-amber-500 rounded-full" />
                <span className="text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">What Drivers Say</span>
                <div className="w-8 h-0.5 bg-amber-500 rounded-full" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Customer Reviews</h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {TESTIMONIALS.map((t, i) => (
                <motion.div
                  key={t.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1 mb-3">
                      {[...Array(t.rating)].map((_, j) => (
                        <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-6 font-normal">"{t.text}"</p>
                  </div>

                  <div className="flex items-center gap-3 pt-3 border-t border-gray-100 dark:border-white/5">
                    <div className="w-9 h-9 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500 font-bold text-sm">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-gray-900 dark:text-white text-sm font-bold">{t.name}</div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-500" /> {t.location}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── DISCOUNT NOTIFICATIONS BANNER ─── */}
        <section className="py-12 px-4 max-w-5xl mx-auto">
          <DiscountBanner />
        </section>

        {/* ─── CTA BANNER ─── */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-600/5 dark:from-amber-500/10 dark:to-amber-600/5 border border-amber-500/30 rounded-3xl p-10 sm:p-14 text-center overflow-hidden shadow-lg"
            >
              <div className="relative z-10">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-3">
                  Ready for Your Next Trip in Ahmedabad?
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto text-base">
                  Choose from 50+ premium vehicles. Free cancellation, no hidden fees, instant doorstep delivery.
                </p>
                <Link
                  to="/fleet"
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full px-9 py-4 transition-all shadow-xl shadow-amber-500/25 text-base"
                >
                  Book Your Car Now <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

      </div>
    </PageWrapper>
  );
}
