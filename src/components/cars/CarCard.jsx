import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Bell, Star } from 'lucide-react';
import { handleImageError } from '../../utils/image';
import { paintFor, paintStyle, rupees } from '../../theme/paints';
import useCarMorph from './useCarMorph';
import { cardPhotoProps, preloadCarPage } from './carPhoto';

// Booking dates are calendar days in India time
const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

/**
 * What the card says about availability. `status` is the effective status from the API:
 * 'Maintenance' (admin took it off the road), 'Rented' (a booking covers today; other dates can
 * still be booked) or 'Available'.
 */
function availability(car) {
  if (car.status === 'Maintenance') return { tag: 'In maintenance', spoken: 'in maintenance', unlit: true, action: 'Notify me when free', notify: true };
  if (car.status === 'Rented') {
    const until = car.nextFreeDate ? `Booked until ${shortDate(car.nextFreeDate)}` : 'Booked today';
    return { tag: until, spoken: until.charAt(0).toLowerCase() + until.slice(1), unlit: false, action: 'Book other dates', notify: false };
  }
  return null;
}

// The footer label, drawn twice: in ink at rest, and again in the on-paint colour inside the paint
const footerRow = 'flex items-center justify-between px-4 py-3 text-sm font-semibold';

export default function CarCard({ car, index = 0 }) {
  const { _id, name, company, type, dailyRate, fuelType, transmission, seats, averageRating, totalReviews, images } = car;
  const paint = paintFor(type);
  const busy = availability(car);
  const lit = !busy?.unlit;
  const openCar = useCarMorph();
  const photoRef = useRef(null);
  const action = busy ? busy.action : 'View and book';
  const ActionIcon = busy?.notify ? Bell : ArrowUpRight;

  // A plain left click (or Enter) opens the car with this photo gliding into the car page's hero,
  // and hands the car over so that page can show it at once. Modifier clicks, middle clicks and
  // "open in new tab" keep ordinary link behaviour.
  const open = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openCar(car, photoRef.current);
  };

  return (
    <Link
      to={`/cars/${_id}`}
      onClick={open}
      onPointerEnter={preloadCarPage}
      onFocus={preloadCarPage}
      style={paintStyle(type)}
      className="group relative block h-full rounded-chip"
      aria-label={`${name}, ${type}, ${rupees(dailyRate)} per day${busy ? `, ${busy.spoken}` : ''}`}
    >
      {/* The link stays put (it is the pointer's target); this surface lifts on hover and gives on press */}
      <div className="relative flex h-full flex-col overflow-hidden rounded-chip border border-line bg-raised transition-[transform,box-shadow,border-color] duration-200 ease-out group-hover:-translate-y-1 group-hover:border-ink/25 group-hover:shadow-lift group-hover:duration-300 group-focus-visible:shadow-lift group-active:scale-[0.98] group-active:duration-100">
        <div className="relative aspect-[16/10] overflow-hidden bg-ink/5">
          {/* The photo that morphs into the car page (rounded like the card's top so the morph starts from its true shape) */}
          <div ref={photoRef} className="absolute inset-0 overflow-hidden rounded-t-[17px]">
            <img
              {...cardPhotoProps(images?.main)}
              alt=""
              width="640"
              height="400"
              loading={index < 3 ? 'eager' : 'lazy'}
              decoding="async"
              onError={(e) => handleImageError(e, 640)}
              className={`h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] ${lit ? '' : 'unlit'}`}
            />
          </div>
          {lit && <span className="card-sheen" aria-hidden="true" />}
          {/* Paint chip */}
          <span className="lacquer absolute left-3 top-3 rounded-lg px-2.5 py-1.5 code-label text-[11px] shadow-soft">
            {paint.no} · {type}
          </span>
          {busy && (
            <span className="absolute right-3 top-3 rounded-full bg-[#0C0C0D]/85 px-3 py-1.5 code-label text-[11px] text-white">
              {busy.tag}
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

          {/* Footer row: the car's paint floods in from the left on hover. The label is drawn again in
              the on-paint colour inside the paint, so the text turns exactly at the paint's edge. */}
          <div className="relative mt-auto pt-5">
            <div className="relative overflow-hidden rounded-xl border border-line">
              <span className={`relative ${footerRow}`}>
                {action}
                <ActionIcon className="w-4 h-4" />
              </span>
              <span
                aria-hidden="true"
                className={`lacquer absolute inset-0 ${footerRow} [clip-path:inset(0_100%_0_0)] transition-[clip-path] duration-300 ease-in-out group-hover:[clip-path:inset(0_0_0_0)] group-hover:duration-500 group-hover:ease-out group-focus-visible:[clip-path:inset(0_0_0_0)]`}
              >
                {action}
                <ActionIcon className="w-4 h-4" />
              </span>
            </div>
            <p className="sr-only">{paint.name}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
