/**
 * ============================================================================
 * CAR DETAIL PAGE
 * ============================================================================
 * Displays complete vehicle specifications, high-definition car gallery,
 * rental rates, verified reviews, and booking initiation.
 * If the car is currently 'Rented' or in 'Maintenance', provides an instant
 * "Notify Me When Available" flow that alerts the customer via email as soon
 * as the car is available again.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Fuel, Settings, Luggage, Gauge, Star, MapPin, Calendar, ArrowRight, Shield, CheckCircle2, Bell } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import PageWrapper from '../components/layout/PageWrapper';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import StarRating from '../components/ui/StarRating';
import NotifyAvailabilityModal from '../components/cars/NotifyAvailabilityModal';

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
    const fetchCar = async () => {
      try {
        const { data } = await api.get(`/cars/${id}`);
        setCar(data.car);
        setReviews(data.reviews || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCar();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0D0D0D] flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );

  if (!car) return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0D0D0D] flex items-center justify-center text-gray-800 dark:text-white">
      Car not found.
    </div>
  );

  const images = [
    { key: 'main', src: car.images?.main },
    { key: 'img1', src: car.images?.img1 },
    { key: 'img2', src: car.images?.img2 },
    { key: 'img3', src: car.images?.img3 },
  ].filter(i => i.src);

  const currentImage = car.images?.[activeImage] || car.images?.main;

  const specs = [
    { icon: Users, label: 'Seats', value: `${car.seats} Persons` },
    { icon: Fuel, label: 'Fuel', value: car.fuelType },
    { icon: Settings, label: 'Gearbox', value: car.transmission },
    { icon: Gauge, label: 'Mileage', value: car.mileage || 'N/A' },
    { icon: Luggage, label: 'Luggage', value: car.luggage },
    { icon: Calendar, label: 'Year', value: car.yearModel },
  ];

  return (
    <PageWrapper>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0D0D0D] text-gray-900 dark:text-white pt-16 transition-colors">

        {/* Split Panel */}
        <div className="flex flex-col lg:flex-row min-h-[85vh]">
          {/* Left: Main Image */}
          <div className="relative lg:w-[60%] min-h-[50vh] lg:min-h-[85vh] overflow-hidden bg-black">
            <motion.img
              key={activeImage}
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35 }}
              src={currentImage}
              alt={car.name}
              className="w-full h-full object-cover"
              style={{ minHeight: '50vh' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/40 lg:block hidden" />

            {/* Bottom overlay on image */}
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 text-white">
              <Badge status={car.type} showDot={false} className="mb-2" />
              <h1 className="text-white text-3xl sm:text-4xl font-black leading-tight">{car.name}</h1>
              <p className="text-gray-300 mt-1 font-medium">{car.company} • {car.yearModel}</p>
              <div className="flex items-center gap-4 mt-3">
                <div className="text-amber-400 text-2xl sm:text-3xl font-black">₹{car.dailyRate.toLocaleString('en-IN')}</div>
                <div className="text-gray-300 text-sm">/day</div>
                <Badge status={car.status} />
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="lg:w-[40%] bg-white dark:bg-[#111] border-l border-gray-200 dark:border-white/[0.06] flex flex-col justify-between">
            {/* Image Gallery Grid */}
            <div className="grid grid-cols-2 gap-1.5 p-2 bg-gray-100 dark:bg-black/30">
              {images.map((img) => (
                <div
                  key={img.key}
                  onClick={() => setActiveImage(img.key)}
                  className={`aspect-video cursor-pointer overflow-hidden rounded-xl ${activeImage === img.key ? 'ring-2 ring-amber-500 shadow-md' : 'opacity-70 hover:opacity-100'} transition-all`}
                >
                  <img src={img.src} alt={car.name} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>

            {/* Details */}
            <div className="flex-1 p-6 sm:p-8 space-y-6 overflow-y-auto">
              {/* Rating */}
              {car.totalReviews > 0 && (
                <div className="flex items-center gap-2">
                  <StarRating value={Math.round(car.averageRating)} />
                  <span className="text-gray-900 dark:text-white font-bold text-sm">{car.averageRating}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">({car.totalReviews} customer reviews)</span>
                </div>
              )}

              {/* Specs Grid */}
              <div className="grid grid-cols-3 gap-3">
                {specs.map((spec) => (
                  <div key={spec.label} className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/[0.06] rounded-xl p-3 text-center shadow-xs">
                    <spec.icon className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                    <div className="text-gray-500 dark:text-gray-400 text-[10px] uppercase font-bold tracking-wider">{spec.label}</div>
                    <div className="text-gray-900 dark:text-white text-xs font-semibold mt-0.5">{spec.value}</div>
                  </div>
                ))}
              </div>

              {/* Description */}
              <div>
                <h3 className="text-gray-900 dark:text-white font-bold text-sm uppercase tracking-wider mb-2">About this vehicle</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{car.description}</p>
              </div>

              {/* Trust badges */}
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 pt-2 border-t border-gray-100 dark:border-white/5">
                <div className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-green-500 flex-shrink-0" /> Zero Security Deposit</div>
                <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-amber-500 flex-shrink-0" /> 8 Ahmedabad Hubs</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" /> Clean & Sanitized</div>
                <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-purple-500 flex-shrink-0" /> Free Cancellation</div>
              </div>

              {/* Book CTA or Notify Availability */}
              {car.status === 'Available' ? (
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    if (!user) { navigate('/login'); return; }
                    navigate(`/booking/${car._id}`);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-base rounded-2xl py-4 transition-all shadow-xl shadow-amber-500/20"
                >
                  Book This Car — ₹{car.dailyRate.toLocaleString('en-IN')}/day <ArrowRight className="w-5 h-5" />
                </motion.button>
              ) : (
                <div className="space-y-3">
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center justify-between">
                    <span>Current Status: <strong className="uppercase">{car.status}</strong></span>
                    <span className="text-[11px] opacity-80">Currently unavailable for immediate booking</span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setShowNotifyModal(true)}
                    className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold text-base rounded-2xl py-4 transition-all shadow-xl shadow-amber-500/25"
                  >
                    <Bell className="w-5 h-5" />
                    Notify Me When Available
                  </motion.button>
                </div>
              )}

              {/* Notify Availability Modal */}
              <NotifyAvailabilityModal
                car={car}
                isOpen={showNotifyModal}
                onClose={() => setShowNotifyModal(false)}
              />
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-gray-900 dark:text-white text-2xl font-extrabold mb-6">
            Customer Reviews {reviews.length > 0 && `(${reviews.length})`}
          </h2>
          {reviews.length === 0 ? (
            <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-10 text-center text-gray-500 dark:text-gray-400 shadow-sm">
              No reviews yet. Be the first to rent and review this car!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {reviews.map((review) => (
                <div key={review._id} className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500 font-bold text-sm">
                        {review.user?.name?.charAt(0)}
                      </div>
                      <div>
                        <div className="text-gray-900 dark:text-white text-sm font-bold">{review.user?.name}</div>
                        <div className="text-gray-400 text-xs">{new Date(review.createdAt).toLocaleDateString('en-IN')}</div>
                      </div>
                    </div>
                    <StarRating value={review.rating} size="sm" />
                  </div>
                  {review.reviewText && <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{review.reviewText}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
