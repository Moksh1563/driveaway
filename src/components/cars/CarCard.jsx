import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Bell, Star } from 'lucide-react';
import { sizedImage, imageSrcSet, handleImageError } from '../../utils/image';
import { paintFor, paintStyle, rupees } from '../../theme/paints';

export default function CarCard({ car, index = 0 }) {
  const { _id, name, company, type, dailyRate, status, fuelType, transmission, seats, averageRating, totalReviews, images } = car;
  const paint = paintFor(type);
  const available = status === 'Available';

  return (
    <Link
      to={`/cars/${_id}`}
      style={paintStyle(type)}
      className="group relative flex h-full flex-col overflow-hidden rounded-chip border border-line bg-raised transition-[box-shadow,border-color] duration-150 ease-out hover:border-ink/25 hover:shadow-lift focus-visible:shadow-lift"
      aria-label={`${name}, ${type}, ${rupees(dailyRate)} per day${available ? '' : `, currently ${status.toLowerCase()}`}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-ink/5">
        <img
          src={sizedImage(images?.main, 640)}
          srcSet={imageSrcSet(images?.main, [400, 640, 960])}
          sizes="(min-width: 1280px) 30vw, (min-width: 640px) 50vw, 100vw"
          alt=""
          width="640"
          height="400"
          loading={index < 3 ? 'eager' : 'lazy'}
          decoding="async"
          onError={(e) => handleImageError(e, 640)}
          className={`h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] ${available ? '' : 'unlit'}`}
        />
        {available && <span className="card-sheen" aria-hidden="true" />}
        {/* Paint chip */}
        <span className="lacquer absolute left-3 top-3 rounded-lg px-2.5 py-1.5 code-label text-[11px] shadow-soft">
          {paint.no} · {type}
        </span>
        {!available && (
          <span className="absolute right-3 top-3 rounded-full bg-[#0C0C0D]/85 px-3 py-1.5 code-label text-[11px] text-white">
            {status}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        {/* Name gets the full width (long makes like LAMBORGHINI never collide with the price) */}
        <h3 className="font-wide font-black uppercase leading-[1.05] tracking-tight text-[17px] [overflow-wrap:anywhere]">{name}</h3>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <p className="code-label text-[11px] text-muted">{company}</p>
          <p className="flex-shrink-0 text-right">
            <span className="font-wide font-black text-lg leading-none">{rupees(dailyRate)}</span>
            <span className="ml-1 text-xs text-muted">/day</span>
          </p>
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
          <div><dt className="sr-only">Seats</dt><dd>{seats} seats</dd></div>
          <div><dt className="sr-only">Fuel</dt><dd>{fuelType}</dd></div>
          <div><dt className="sr-only">Gearbox</dt><dd>{transmission}</dd></div>
          {totalReviews > 0 && (
            <div className="flex items-center gap-1 text-ink">
              <dt className="sr-only">Rating</dt>
              <Star className="w-3.5 h-3.5 fill-current" />
              <dd className="font-semibold">{averageRating}</dd>
              <span className="text-muted">({totalReviews})</span>
            </div>
          )}
        </dl>

        {/* Footer row fills with the car's paint on hover */}
        <div className="relative mt-auto pt-5">
          <div className="relative overflow-hidden rounded-xl border border-line">
            <span className="lacquer absolute inset-0 origin-left scale-x-0 transition-transform duration-300 ease-in-out group-hover:scale-x-100 group-focus-visible:scale-x-100" aria-hidden="true" />
            <span className="relative flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors duration-150 group-hover:text-on-paint group-focus-visible:text-on-paint">
              {available ? 'View and book' : 'Notify me when free'}
              {available ? <ArrowUpRight className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </span>
          </div>
          <p className="sr-only">{paint.name}</p>
        </div>
      </div>
    </Link>
  );
}
