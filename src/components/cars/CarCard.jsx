import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Fuel, Settings, Star, ArrowRight } from 'lucide-react';
import Badge from '../ui/Badge';

export default function CarCard({ car, index = 0 }) {
  const {
    _id, name, company, type, dailyRate, status, fuelType,
    transmission, seats, averageRating, totalReviews, images,
  } = car;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      className="group bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden hover:shadow-xl dark:hover:shadow-amber-500/10 transition-all duration-300 shadow-sm"
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden bg-gray-100 dark:bg-gray-800">
        <img
          src={images?.main || 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800'}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          <Badge status={status} />
        </div>
        {/* Type Badge */}
        <div className="absolute bottom-3 left-3">
          <Badge status={type} showDot={false} />
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-3">
        {/* Title & Price */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-gray-900 dark:text-white font-bold text-base leading-tight">{name}</h3>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 font-medium">{company}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-amber-500 font-black text-lg">₹{dailyRate.toLocaleString('en-IN')}</div>
            <div className="text-gray-400 text-[11px]">/day</div>
          </div>
        </div>

        {/* Rating */}
        {totalReviews > 0 && (
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-gray-900 dark:text-white text-xs font-semibold">{averageRating}</span>
            <span className="text-gray-500 dark:text-gray-400 text-xs">({totalReviews} reviews)</span>
          </div>
        )}

        {/* Specs */}
        <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400 text-xs font-medium pt-1 border-t border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-500" />
            <span>{seats} Seats</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Fuel className="w-3.5 h-3.5 text-amber-500" />
            <span>{fuelType}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 text-amber-500" />
            <span>{transmission}</span>
          </div>
        </div>

        {/* CTA */}
        <Link
          to={`/cars/${_id}`}
          className={`w-full flex items-center justify-center gap-2 font-bold text-sm rounded-xl py-2.5 transition-all shadow-sm active:scale-[0.98] ${
            status === 'Available'
              ? 'bg-amber-500 hover:bg-amber-400 text-black'
              : 'bg-gray-100 hover:bg-amber-500 hover:text-black dark:bg-white/5 dark:hover:bg-amber-500 dark:hover:text-black text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/10'
          }`}
        >
          {status === 'Available' ? (
            <>View Details <ArrowRight className="w-4 h-4" /></>
          ) : (
            <>🔔 Notify When Available <ArrowRight className="w-4 h-4" /></>
          )}
        </Link>
      </div>
    </motion.div>
  );
}
