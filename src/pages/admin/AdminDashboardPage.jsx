import React, { useCallback, useEffect, useState } from 'react';
import { m } from 'framer-motion';
import { IndianRupee, Car, Calendar, Users, TrendingUp, Clock } from 'lucide-react';
import api from '../../api/axios';
import StatCard from '../../components/admin/StatCard';
import LoadError from '../../components/admin/LoadError';
import Badge from '../../components/ui/Badge';
import { sizedImage, handleImageError } from '../../utils/image';
import { AdminDashboardSkeleton } from '../../components/ui/Skeletons';
import { EASE } from '../../theme/motion';
import EmailStatusCard from '../../components/admin/EmailStatusCard';

// Read every figure defensively: a missing or malformed field shows 0, never NaN
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const list = (v) => (Array.isArray(v) ? v : []);
const rupees = (v) => `₹${Math.round(num(v)).toLocaleString('en-IN')}`;

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.get('/admin/dashboard')
      .then(({ data }) => setStats(data || {}))
      .catch((err) => setError(err.response?.data?.message || 'Could not load the overview.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !stats) return <AdminDashboardSkeleton />;

  const s = stats || {};
  const monthlyRevenue = list(s.monthlyRevenue);
  const maxRev = Math.max(1, ...monthlyRevenue.map((entry) => num(entry.revenue)));
  // Confirmed bookings (upcoming or on the road). Older APIs sent only activeRentals, which then meant the same count;
  // newer ones send confirmedBookings and use activeRentals for trips under way today.
  const hasConfirmed = s.confirmedBookings !== undefined;
  const confirmed = num(hasConfirmed ? s.confirmedBookings : s.activeRentals);
  const confirmedNote = hasConfirmed ? `${num(s.activeRentals)} on the road today` : 'Upcoming or on the road';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-wide font-black uppercase tracking-tight text-2xl sm:text-3xl">Overview</h1>
        <p className="text-muted text-sm mt-1">Live analytics & performance metrics for Driveaway Ahmedabad.</p>
      </div>

      {error && <LoadError message={error} onRetry={load} />}

      <EmailStatusCard />

      {stats && (
        <>
          {/* Main Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Collected Revenue" value={rupees(s.totalRevenue)} icon={IndianRupee} subtitle="Payments received, cancelled bookings excluded" />
            <StatCard title="Total Bookings" value={num(s.totalBookings)} icon={Calendar} subtitle={`${num(s.pendingBookings)} pending · ${num(s.completedBookings)} completed`} />
            <StatCard title="Total Cars" value={num(s.totalCars)} icon={Car} subtitle={`${num(s.availableCars)} available now`} />
            <StatCard title="Total Users" value={num(s.totalUsers)} icon={Users} />
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Confirmed" value={confirmed} icon={TrendingUp} subtitle={confirmedNote} />
            <StatCard title="Pending" value={num(s.pendingBookings)} icon={Clock} subtitle="Waiting for confirmation" />
            <StatCard title="Booked Now" value={num(s.rentedCars)} icon={Car} subtitle="Cars with a booking covering today" />
            <StatCard title="In Maintenance" value={num(s.maintenanceCars)} icon={Car} color="red" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart (CSS bar chart) */}
            <div className="bg-surface border border-line rounded-chip p-6 shadow-sm">
              <h2 className="text-ink font-extrabold text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-ink" aria-hidden="true" /> Collected Revenue (Last 6 Months)
              </h2>
              <p className="text-muted text-xs mt-1 mb-6">Grouped by the month each payment was received.</p>
              {monthlyRevenue.length === 0 ? (
                <p className="text-muted text-sm">No payments recorded yet.</p>
              ) : (
                <div className="flex items-end gap-3 h-44 pt-4 border-b border-line pb-2">
                  {monthlyRevenue.map((entry, i) => {
                    const revenue = num(entry.revenue);
                    const label = String(entry.month || '');
                    return (
                      <div key={label || i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <span className="text-muted text-[11px] font-bold">
                          ₹{revenue > 999 ? (revenue / 1000).toFixed(0) + 'K' : Math.round(revenue)}
                        </span>
                        <m.div
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{ duration: 0.4, delay: Math.min(i, 5) * 0.04, ease: EASE.out }}
                          style={{ height: `${(revenue / maxRev) * 100}%`, transformOrigin: 'bottom' }}
                          className="w-full rounded-t-lg min-h-[6px] bg-ink"
                          aria-hidden="true"
                        />
                        <span className="text-muted text-[11px] font-semibold text-center leading-tight" title={`${label}: ${rupees(revenue)}`}>
                          {label.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Cars */}
            <div className="bg-surface border border-line rounded-chip p-6 shadow-sm">
              <h2 className="text-ink font-extrabold text-base mb-4 flex items-center gap-2">
                <Car className="w-4 h-4 text-ink" aria-hidden="true" /> Top Performing Vehicles
              </h2>
              <div className="space-y-3.5">
                {list(s.topCars).length === 0 && <p className="text-muted text-sm">No bookings yet.</p>}
                {list(s.topCars).map((car, i) => (
                  <div key={car._id || i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-ink/5 transition-colors">
                    <span className="text-ink text-xs font-black w-4">#{i + 1}</span>
                    <img src={sizedImage(car.images?.main, 160)} alt="" loading="lazy" decoding="async" onError={(e) => handleImageError(e, 160)} className="w-12 h-8 object-cover rounded-lg bg-ink/5 " />
                    <div className="flex-1 min-w-0">
                      <p className="text-ink text-xs font-bold truncate">{car.name}</p>
                      <p className="text-muted text-[11px] font-medium">{car.type} • {rupees(car.dailyRate)}/d</p>
                    </div>
                    <span className="text-muted text-xs font-semibold">{num(car.bookingCount)} trips</span>
                    {car.status && <Badge status={car.status} showDot={false} className="text-[11px]" />}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Bookings */}
          <div className="bg-surface border border-line rounded-chip p-6 shadow-sm">
            <h2 className="text-ink font-extrabold text-base mb-4">Recent Bookings</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted text-xs uppercase font-bold tracking-wider border-b border-line">
                    <th scope="col" className="text-left pb-3">Invoice</th>
                    <th scope="col" className="text-left pb-3">Customer</th>
                    <th scope="col" className="text-left pb-3">Car</th>
                    <th scope="col" className="text-left pb-3">Amount</th>
                    <th scope="col" className="text-left pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list(s.recentBookings).map(b => (
                    <tr key={b._id} className="hover:bg-ink/5 transition-colors">
                      <td className="py-3.5 text-ink font-mono text-xs font-bold">{b.invoiceNumber}</td>
                      <td className="py-3.5 text-ink font-medium">{b.user?.name || b.customerName}</td>
                      <td className="py-3.5 text-muted font-medium">{b.car?.name}</td>
                      <td className="py-3.5 text-ink font-bold">
                        {rupees(b.totalAmount)}
                        {b.paymentCompleted !== undefined && (
                          <span className={`ml-2 text-xs font-bold ${b.paymentCompleted ? 'text-ok' : 'text-warn'}`}>
                            {b.paymentCompleted ? 'Paid' : 'Unpaid'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5"><Badge status={b.status} /></td>
                    </tr>
                  ))}
                  {list(s.recentBookings).length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-muted">No bookings yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
