import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { IndianRupee, Car, Calendar, Users, TrendingUp, Clock } from 'lucide-react';
import api from '../../api/axios';
import StatCard from '../../components/admin/StatCard';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard').then(({ data }) => { setStats(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center pt-20"><Spinner size="lg" /></div>;

  const maxRev = Math.max(...(stats?.monthlyRevenue?.map(m => m.revenue) || [1]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-gray-900 dark:text-white text-2xl sm:text-3xl font-extrabold tracking-tight">Admin Overview</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Live analytics & performance metrics for Driveaway Ahmedabad.</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={`₹${(stats?.totalRevenue || 0).toLocaleString('en-IN')}`} icon={IndianRupee} color="amber" subtitle={`${stats?.completedBookings || 0} completed bookings`} />
        <StatCard title="Total Bookings" value={stats?.totalBookings || 0} icon={Calendar} color="blue" subtitle={`${stats?.pendingBookings || 0} pending`} />
        <StatCard title="Total Cars" value={stats?.totalCars || 0} icon={Car} color="green" subtitle={`${stats?.availableCars || 0} available`} />
        <StatCard title="Total Users" value={stats?.totalUsers || 0} icon={Users} color="purple" />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Rentals" value={stats?.activeRentals || 0} icon={TrendingUp} color="green" />
        <StatCard title="Pending" value={stats?.pendingBookings || 0} icon={Clock} color="amber" />
        <StatCard title="Rented Cars" value={stats?.rentedCars || 0} icon={Car} color="blue" />
        <StatCard title="In Maintenance" value={stats?.maintenanceCars || 0} icon={Car} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart (CSS bar chart) */}
        <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm">
          <h2 className="text-gray-900 dark:text-white font-extrabold text-base mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" /> Monthly Revenue (Last 6 Months)
          </h2>
          <div className="flex items-end gap-3 h-44 pt-4 border-b border-gray-100 dark:border-white/5 pb-2">
            {stats?.monthlyRevenue?.map((m, i) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-gray-500 text-[10px] font-bold">
                  ₹{m.revenue > 999 ? (m.revenue / 1000).toFixed(0) + 'K' : m.revenue}
                </span>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${maxRev ? (m.revenue / maxRev) * 100 : 5}%` }}
                  transition={{ duration: 0.6, delay: i * 0.08 }}
                  className="w-full bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-lg min-h-[6px] shadow-xs"
                />
                <span className="text-gray-500 text-[10px] font-semibold text-center leading-tight">{m.month.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Cars */}
        <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm">
          <h2 className="text-gray-900 dark:text-white font-extrabold text-base mb-4 flex items-center gap-2">
            <Car className="w-4 h-4 text-amber-500" /> Top Performing Vehicles
          </h2>
          <div className="space-y-3.5">
            {stats?.topCars?.map((car, i) => (
              <div key={car._id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                <span className="text-amber-500 text-xs font-black w-4">#{i + 1}</span>
                <img src={car.images?.main} alt={car.name} className="w-12 h-8 object-cover rounded-lg bg-gray-100 dark:bg-gray-800" />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 dark:text-white text-xs font-bold truncate">{car.name}</p>
                  <p className="text-gray-500 text-[11px] font-medium">{car.type} • ₹{car.dailyRate?.toLocaleString('en-IN')}/d</p>
                </div>
                <span className="text-gray-600 dark:text-gray-400 text-xs font-semibold">{car.bookingCount} trips</span>
                <Badge status={car.status} showDot={false} className="text-[10px]" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm">
        <h2 className="text-gray-900 dark:text-white font-extrabold text-base mb-4">Recent Bookings</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold tracking-wider border-b border-gray-100 dark:border-white/10">
                <th className="text-left pb-3">Invoice</th>
                <th className="text-left pb-3">Customer</th>
                <th className="text-left pb-3">Car</th>
                <th className="text-left pb-3">Amount</th>
                <th className="text-left pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {stats?.recentBookings?.map(b => (
                <tr key={b._id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 text-amber-500 font-mono text-xs font-bold">{b.invoiceNumber}</td>
                  <td className="py-3.5 text-gray-800 dark:text-gray-200 font-medium">{b.user?.name || b.customerName}</td>
                  <td className="py-3.5 text-gray-600 dark:text-gray-300 font-medium">{b.car?.name}</td>
                  <td className="py-3.5 text-gray-900 dark:text-white font-bold">₹{b.totalAmount?.toLocaleString('en-IN')}</td>
                  <td className="py-3.5"><Badge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
