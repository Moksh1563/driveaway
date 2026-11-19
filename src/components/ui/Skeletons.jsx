/**
 * Loading skeletons shaped like the pages they stand in for, so the layout appears instantly
 * and real content drops into place. Bones shimmer with a clear-coat sweep (static under
 * reduced motion). Painted regions use on-paint bones.
 */
import React from 'react';
import { useLocation } from 'react-router-dom';
import { paintStyle } from '../../theme/paints';

/** A single placeholder block. `onPaint` for bones sitting on a lacquer band. */
export function Bone({ className = '', onPaint = false, style }) {
  return <div className={`${onPaint ? 'skeleton-on-paint' : 'skeleton'} ${className}`} style={style} aria-hidden="true" />;
}

/** Announces loading to screen readers once per skeleton. */
function Loading({ label = 'Loading' }) {
  return <span className="sr-only" role="status">{label}…</span>;
}

export function CarCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-chip border border-line bg-raised" aria-hidden="true">
      <Bone className="aspect-[16/10] !rounded-none" />
      <div className="space-y-3 p-5">
        <Bone className="h-5 w-3/4" />
        <div className="flex items-center justify-between gap-4">
          <Bone className="h-3 w-1/4" />
          <Bone className="h-5 w-20" />
        </div>
        <Bone className="h-3 w-2/3" />
        <Bone className="mt-2 h-11 w-full" />
      </div>
    </div>
  );
}

export function CarGridSkeleton({ count = 6, className = '' }) {
  return (
    <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 ${className}`}>
      {[...Array(count)].map((_, i) => <CarCardSkeleton key={i} />)}
    </div>
  );
}

/** Home: paint band with headline, copy, order slip, car frame and the swatch fan. */
export function HomeSkeleton() {
  return (
    <div className="pt-[72px]">
      <Loading label="Loading Driveaway" />
      <section style={paintStyle('Hypercar')} className="lacquer relative overflow-hidden">
        <div className="page-container pt-8 pb-36 lg:pt-10">
          <Bone onPaint className="h-14 w-[70%] sm:h-16" />
          <Bone onPaint className="mt-3 h-14 w-[88%] sm:h-16" />
          <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:gap-10">
            <div className="order-first lg:order-none lg:col-span-7 lg:col-start-6 lg:row-start-1">
              <Bone onPaint className="aspect-[16/10] !rounded-[28px] !rounded-bl-[96px] lg:aspect-auto lg:h-[360px]" />
            </div>
            <div className="lg:col-span-5 lg:col-start-1 lg:row-start-1">
              <Bone onPaint className="h-4 w-11/12" />
              <Bone onPaint className="mt-2 h-4 w-3/4" />
              <Bone onPaint className="mt-5 h-3 w-1/2" />
              <div className="mt-5 rounded-chip bg-raised p-5 shadow-lift">
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => <Bone key={i} className="h-11" />)}
                </div>
                <Bone className="mt-4 h-14 !rounded-full" />
              </div>
            </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0">
          <div className="page-container flex items-end">
            {[...Array(5)].map((_, i) => (
              <Bone key={i} onPaint className={`h-28 w-[150px] flex-shrink-0 !rounded-b-none !rounded-t-[18px] sm:w-[172px] ${i ? '-ml-2' : ''}`} style={{ transform: `translateY(${i === 1 ? -6 : 14}px)` }} />
            ))}
          </div>
        </div>
      </section>
      <div className="page-container py-20">
        <Bone className="h-10 w-72" />
        <CarGridSkeleton count={3} className="mt-10" />
      </div>
    </div>
  );
}

/** Fleet: header band, paint filter row, filter sidebar and car grid. */
export function FleetSkeleton() {
  return (
    <div className="pt-[72px]">
      <Loading label="Loading the fleet" />
      <div className="border-b border-line">
        <div className="page-container pt-12 pb-8">
          <Bone className="h-16 w-80 max-w-full" />
          <Bone className="mt-4 h-4 w-56" />
          <Bone className="mt-8 h-px w-full !rounded-none" />
        </div>
      </div>
      <div className="border-b border-line">
        <div className="page-container flex gap-2 overflow-hidden py-4">
          {[...Array(9)].map((_, i) => <Bone key={i} className="h-10 w-28 flex-shrink-0 !rounded-full" />)}
        </div>
      </div>
      <div className="page-container flex gap-10 py-10">
        <div className="hidden w-60 flex-shrink-0 space-y-8 md:block">
          {[0, 1, 2].map((g) => (
            <div key={g}>
              <Bone className="h-3 w-20" />
              <div className="mt-3 flex flex-wrap gap-2">
                {[...Array(g === 2 ? 2 : 3)].map((_, i) => <Bone key={i} className="h-9 w-20 !rounded-full" />)}
              </div>
            </div>
          ))}
        </div>
        <CarGridSkeleton className="min-w-0 flex-1" />
      </div>
    </div>
  );
}

/** Car detail: title band, large photo with gallery, spec sheet and booking panel. */
export function CarDetailSkeleton() {
  return (
    <div className="pt-[72px]">
      <Loading label="Loading car" />
      <section className="bg-surface">
        <div className="page-container pt-8 pb-44 lg:pb-52">
          <Bone className="h-4 w-32" />
          <Bone className="mt-8 h-16 w-[65%]" />
          <Bone className="mt-4 h-3 w-64" />
        </div>
      </section>
      <div className="page-container -mt-36 grid gap-10 pb-20 lg:-mt-44 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <Bone className="aspect-[16/10] !rounded-[28px] !rounded-bl-[96px] shadow-lift" />
          <div className="mt-4 flex gap-3">
            {[...Array(4)].map((_, i) => <Bone key={i} className="aspect-[16/10] w-32" />)}
          </div>
          <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-chip border border-line sm:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-ground p-5">
                <Bone className="h-3 w-16" />
                <Bone className="mt-2 h-5 w-24" />
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-4">
          <div className="rounded-chip border border-line bg-surface p-6 shadow-lift">
            <Bone className="h-8 w-40" />
            <Bone className="mt-3 h-4 w-48" />
            <Bone className="mt-6 h-14 !rounded-full" />
            <div className="mt-6 space-y-3 border-t border-line pt-6">
              {[...Array(4)].map((_, i) => <Bone key={i} className="h-4 w-3/4" />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Booking: title band with step pills, form fields and the fare sheet. */
export function BookingSkeleton() {
  return (
    <div className="pt-[72px]">
      <Loading label="Loading booking" />
      <section className="bg-surface">
        <div className="page-container flex flex-wrap items-end justify-between gap-6 py-10">
          <div>
            <Bone className="h-12 w-[28rem] max-w-[80vw]" />
            <Bone className="mt-4 h-3 w-64" />
          </div>
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => <Bone key={i} className="h-10 w-24 !rounded-full" />)}
          </div>
        </div>
      </section>
      <div className="page-container grid gap-10 py-10 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Bone className="h-6 w-56" />
          <Bone className="h-12" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[...Array(3)].map((_, i) => <Bone key={i} className="h-12" />)}
          </div>
          <Bone className="mt-6 h-6 w-48" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Bone className="h-24 !rounded-chip" />
            <Bone className="h-24 !rounded-chip" />
          </div>
        </div>
        <div className="lg:col-span-4">
          <div className="overflow-hidden rounded-chip border border-line bg-surface">
            <Bone className="aspect-[16/9] !rounded-none" />
            <div className="space-y-3 p-5">
              {[...Array(3)].map((_, i) => <Bone key={i} className="h-4" />)}
              <Bone className="mt-4 h-9 w-1/2 ml-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Booking success: headline and the job sheet. */
export function SuccessSkeleton() {
  return (
    <div className="pt-[72px]">
      <Loading label="Loading your booking" />
      <section className="bg-surface">
        <div className="page-container grid gap-10 py-14 lg:grid-cols-12 lg:py-20">
          <div className="lg:col-span-6">
            <Bone className="h-16 w-11/12" />
            <Bone className="mt-3 h-16 w-3/4" />
            <Bone className="mt-6 h-4 w-80 max-w-full" />
            <div className="mt-8 flex gap-3">
              <Bone className="h-12 w-44 !rounded-full" />
              <Bone className="h-12 w-44 !rounded-full" />
            </div>
          </div>
          <div className="lg:col-span-6">
            <div className="overflow-hidden rounded-chip bg-raised shadow-lift">
              <Bone className="aspect-[16/7] !rounded-none" />
              <div className="divide-y divide-line">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex justify-between px-6 py-4"><Bone className="h-4 w-20" /><Bone className="h-4 w-36" /></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** A list of booking rows (dashboard garage and bookings tab). */
export function BookingRowsSkeleton({ count = 3 }) {
  return (
    <div className="space-y-4" aria-hidden="true">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="overflow-hidden rounded-chip border border-line bg-surface">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
            <Bone className="h-20 w-full flex-shrink-0 sm:w-32" />
            <div className="flex-1 space-y-2">
              <Bone className="h-5 w-48" />
              <Bone className="h-3 w-64 max-w-full" />
              <Bone className="h-4 w-28" />
            </div>
          </div>
          <div className="flex gap-2 border-t border-line px-5 py-3">
            {[...Array(3)].map((__, j) => <Bone key={j} className="h-10 w-24 !rounded-full" />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The dashboard's garage ring of paint chips. */
export function GarageRingSkeleton() {
  return (
    <div className="flex items-end gap-2" aria-hidden="true">
      {[0, 1, 2].map((i) => <Bone key={i} className={`w-44 !rounded-b-none !rounded-t-[16px] ${i === 0 ? 'h-32' : 'h-24'}`} />)}
    </div>
  );
}

/** Admin: a table of rows. */
export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="overflow-hidden rounded-chip border border-line bg-surface" aria-hidden="true">
      <div className="flex gap-6 border-b border-line px-5 py-4">
        {[...Array(cols)].map((_, i) => <Bone key={i} className="h-3 flex-1" />)}
      </div>
      {[...Array(rows)].map((_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-line px-5 py-4 last:border-b-0">
          <Bone className="h-9 w-14 flex-shrink-0" />
          {[...Array(cols - 1)].map((_, i) => <Bone key={i} className={`h-4 flex-1 ${i === cols - 2 ? 'max-w-[6rem]' : ''}`} />)}
        </div>
      ))}
    </div>
  );
}

/** Admin overview: stat tiles, chart and lists. */
export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Loading label="Loading overview" />
      <Bone className="h-9 w-56" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-chip border border-line bg-surface p-5">
            <Bone className="h-3 w-24" />
            <Bone className="mt-4 h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex h-72 items-end gap-3 rounded-chip border border-line bg-surface p-6">
          {[40, 25, 55, 30, 85, 60].map((h, i) => <Bone key={i} className="flex-1 !rounded-b-none" style={{ height: `${h}%` }} />)}
        </div>
        <div className="space-y-4 rounded-chip border border-line bg-surface p-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3"><Bone className="h-9 w-12" /><Bone className="h-4 flex-1" /><Bone className="h-6 w-20 !rounded-full" /></div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Generic page: title band and some text blocks. */
export function PageSkeleton() {
  return (
    <div className="pt-[72px]">
      <Loading />
      <div className="page-container grid gap-12 py-20 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Bone className="h-16 w-full" />
          <Bone className="mt-3 h-16 w-2/3" />
        </div>
        <div className="space-y-3 lg:col-span-5">
          {[...Array(5)].map((_, i) => <Bone key={i} className={`h-4 ${i === 4 ? 'w-2/3' : 'w-full'}`} />)}
        </div>
      </div>
    </div>
  );
}

/** Sign-in / sign-up: paint panel beside the form. */
export function AuthSkeleton() {
  return (
    <div className="grid min-h-screen pt-[72px] lg:grid-cols-2">
      <Loading />
      <div style={paintStyle('Supercar')} className="lacquer hidden px-12 pt-16 lg:block">
        <Bone onPaint className="h-20 w-3/4" />
        <Bone onPaint className="mt-3 h-20 w-1/2" />
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-5">
          {[...Array(2)].map((_, i) => <div key={i}><Bone className="h-3 w-28" /><Bone className="mt-2 h-12" /></div>)}
          <Bone className="h-14 !rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** Picks the skeleton that matches the route being loaded (used as the Suspense fallback). */
export function RouteSkeleton() {
  const { pathname } = useLocation();
  if (pathname === '/') return <HomeSkeleton />;
  if (pathname.startsWith('/fleet')) return <FleetSkeleton />;
  if (pathname.startsWith('/cars/')) return <CarDetailSkeleton />;
  if (pathname.startsWith('/booking-success')) return <SuccessSkeleton />;
  if (pathname.startsWith('/booking/')) return <BookingSkeleton />;
  if (pathname === '/login' || pathname === '/register' || pathname === '/forgot-password' || pathname.startsWith('/reset-password')) {
    return <AuthSkeleton />;
  }
  if (pathname.startsWith('/dashboard')) {
    return (
      <div className="pt-[72px]">
        <Loading label="Loading your garage" />
        <div className="page-container border-b border-line pt-12 pb-8">
          <Bone className="h-16 w-96 max-w-full" />
          <Bone className="mt-4 h-4 w-56" />
          <div className="mt-10"><GarageRingSkeleton /></div>
        </div>
        <div className="page-container py-10"><BookingRowsSkeleton /></div>
      </div>
    );
  }
  if (pathname.startsWith('/admin')) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden w-64 border-r border-line bg-surface p-4 lg:block">
          <Bone className="h-9 w-40" />
          <div className="mt-8 space-y-3">{[...Array(6)].map((_, i) => <Bone key={i} className="h-10" />)}</div>
        </div>
        <div className="flex-1 p-5 sm:p-8"><AdminDashboardSkeleton /></div>
      </div>
    );
  }
  return <PageSkeleton />;
}
