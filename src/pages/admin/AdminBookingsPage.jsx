import React, { useState, useEffect } from 'react';
import { Search, Download, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { generatePDF, sendWhatsAppInvoice } from '../../components/invoice/InvoiceGenerator';

const STATUSES = ['All', 'Pending', 'Confirmed', 'Completed', 'Cancelled'];

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [viewModal, setViewModal] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => { fetchBookings(); }, [page, statusFilter, search]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10, search };
      if (statusFilter !== 'All') params.status = statusFilter;
      const { data } = await api.get('/bookings', { params });
      setBookings(data.bookings || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleStatusChange = async (id, status) => {
    setUpdatingId(id);
    try {
      await api.patch(`/bookings/${id}/status`, { status });
      toast.success(`Booking status updated to ${status}`);
      fetchBookings();
    } catch { toast.error('Failed to update status'); }
    finally { setUpdatingId(null); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this booking?')) return;
    try {
      await api.delete(`/bookings/${id}`);
      toast.success('Booking deleted');
      fetchBookings();
    } catch { toast.error('Failed to delete booking'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 dark:text-white text-2xl sm:text-3xl font-extrabold tracking-tight">Bookings Management</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{total} bookings recorded across Ahmedabad hubs</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by invoice number, driver name, email..."
            className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl pl-10 pr-4 py-3 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                statusFilter === s
                  ? 'bg-amber-500 border-amber-500 text-black shadow-sm'
                  : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-amber-500'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold tracking-wider border-b border-gray-100 dark:border-white/10">
                  {['Invoice', 'Customer', 'Car', 'Trip Dates', 'Amount', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left p-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {bookings.map(b => (
                  <tr key={b._id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 font-mono text-amber-500 font-bold text-xs">{b.invoiceNumber}</td>
                    <td className="p-4">
                      <p className="text-gray-900 dark:text-white font-bold">{b.user?.name || b.customerName}</p>
                      <p className="text-gray-500 text-xs">{b.user?.email || b.customerEmail}</p>
                    </td>
                    <td className="p-4 text-gray-700 dark:text-gray-300 font-medium">{b.car?.name}</td>
                    <td className="p-4 text-gray-500 dark:text-gray-400 text-xs font-medium">
                      {new Date(b.pickupDate).toLocaleDateString('en-IN')}<br />
                      → {new Date(b.returnDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="p-4">
                      <p className="text-gray-900 dark:text-white font-extrabold">₹{b.totalAmount?.toLocaleString('en-IN')}</p>
                      {b.paymentCompleted ? (
                        <p className="text-green-600 dark:text-green-400 text-xs font-bold">✓ Paid</p>
                      ) : (
                        <p className="text-yellow-600 dark:text-yellow-400 text-xs font-bold">Pending</p>
                      )}
                    </td>
                    <td className="p-4">
                      <select
                        value={b.status}
                        disabled={updatingId === b._id}
                        onChange={e => handleStatusChange(b._id, e.target.value)}
                        className="bg-white dark:bg-[#0D0D0D] border border-gray-300 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-gray-900 dark:text-white text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-xs"
                      >
                        {['Pending', 'Confirmed', 'Completed', 'Cancelled'].map(s => (
                          <option key={s} value={s} className="bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white">{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setViewModal(b)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors text-xs font-medium"
                          title="View Details"
                        >
                          👁
                        </button>
                        <button
                          onClick={() => generatePDF(b, b.car)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-amber-500 hover:text-amber-500 transition-colors"
                          title="Download Invoice PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => sendWhatsAppInvoice(b, b.car)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                          title="Send Invoice on WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(b._id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors text-xs font-bold"
                          title="Delete Booking"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-white/10">
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{total} total • Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-300 text-xs font-semibold disabled:opacity-30 hover:border-amber-500 hover:text-amber-500 transition-colors"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-300 text-xs font-semibold disabled:opacity-30 hover:border-amber-500 hover:text-amber-500 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Detail Modal */}
      <Modal isOpen={!!viewModal} onClose={() => setViewModal(null)} title="Booking Breakdown" size="md">
        {viewModal && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 dark:bg-white/[0.02] p-4 rounded-xl border border-gray-100 dark:border-white/5">
              {[
                ['Invoice ID', viewModal.invoiceNumber],
                ['Status', viewModal.status],
                ['Vehicle', viewModal.car?.name],
                ['Customer Name', viewModal.customerName],
                ['Email', viewModal.customerEmail],
                ['Phone', viewModal.customerPhone],
                ['Pickup Location', viewModal.pickupLocation],
                ['Pickup Date', new Date(viewModal.pickupDate).toLocaleDateString('en-IN')],
                ['Return Date', new Date(viewModal.returnDate).toLocaleDateString('en-IN')],
                ['Duration', `${viewModal.totalDays} Days`],
                ['Daily Rate', `₹${viewModal.dailyRateSnapshot?.toLocaleString('en-IN')}`],
                ['Discount Applied', viewModal.discountAmount > 0 ? `-₹${viewModal.discountAmount?.toLocaleString('en-IN')} (${viewModal.discountCode})` : 'None'],
                ['Loyalty Points', viewModal.loyaltyPointsUsed > 0 ? `${viewModal.loyaltyPointsUsed} pts used` : 'None'],
                ['Final Total Amount', `₹${viewModal.totalAmount?.toLocaleString('en-IN')}`],
                ['Payment Method', viewModal.paymentMethod],
                ['Payment Status', viewModal.paymentCompleted ? '✓ Paid' : '⏳ Pending'],
                ['Driver License', viewModal.licenseNumber],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">{k}</p>
                  <p className="text-gray-900 dark:text-white font-semibold mt-0.5">{v || '—'}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Button onClick={() => generatePDF(viewModal, viewModal.car)} icon={Download} variant="secondary" className="w-full font-bold">
                Invoice PDF
              </Button>
              <button
                type="button"
                onClick={() => sendWhatsAppInvoice(viewModal, viewModal.car)}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm shadow-sm"
              >
                <MessageCircle className="w-4 h-4 text-white" />
                WhatsApp Invoice
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
