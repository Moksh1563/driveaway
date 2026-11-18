import React, { useState, useEffect } from 'react';
import { Search, Download, MessageCircle, Eye, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { generatePDF, sendWhatsAppInvoice } from '../../components/invoice/InvoiceGenerator';
import { TableSkeleton } from '../../components/ui/Skeletons';

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
          <h1 className="font-wide font-black uppercase tracking-tight text-2xl sm:text-3xl">Bookings</h1>
          <p className="text-muted text-sm mt-1">{total} bookings recorded across Ahmedabad hubs</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by invoice number, driver name, email..."
            className="w-full bg-raised border border-line rounded-chip pl-10 pr-4 py-3 text-ink text-sm outline-none focus:ring-2 focus:ring-ink/30 "
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
 statusFilter === s
 ? 'bg-ink border-ink text-ground shadow-sm'
 : 'bg-raised border-line text-muted hover:border-ink'
 }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? <TableSkeleton cols={6} /> : (
        <div className="bg-surface border border-line rounded-chip overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-xs uppercase font-bold tracking-wider border-b border-line">
                  {['Invoice', 'Customer', 'Car', 'Trip Dates', 'Amount', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left p-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {bookings.map(b => (
                  <tr key={b._id} className="hover:bg-ink/5 transition-colors">
                    <td className="p-4 font-mono text-ink font-bold text-xs">{b.invoiceNumber}</td>
                    <td className="p-4">
                      <p className="text-ink font-bold">{b.user?.name || b.customerName}</p>
                      <p className="text-muted text-xs">{b.user?.email || b.customerEmail}</p>
                    </td>
                    <td className="p-4 text-muted font-medium">{b.car?.name}</td>
                    <td className="p-4 text-muted text-xs font-medium">
                      {new Date(b.pickupDate).toLocaleDateString('en-IN')}<br />
                      → {new Date(b.returnDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="p-4">
                      <p className="text-ink font-extrabold">₹{b.totalAmount?.toLocaleString('en-IN')}</p>
                      {b.paymentCompleted ? (
                        <p className="text-green-600 dark:text-green-400 text-xs font-bold">Paid</p>
                      ) : (
                        <p className="text-yellow-600 dark:text-yellow-400 text-xs font-bold">Pending</p>
                      )}
                    </td>
                    <td className="p-4">
                      <select
                        value={b.status}
                        disabled={updatingId === b._id}
                        onChange={e => handleStatusChange(b._id, e.target.value)}
                        className="bg-ground border border-line rounded-xl px-2.5 py-1.5 text-ink text-xs font-bold outline-none focus:ring-2 focus:ring-ink/30 cursor-pointer "
                      >
                        {['Pending', 'Confirmed', 'Completed', 'Cancelled'].map(s => (
                          <option key={s} value={s} className="bg-surface text-ink">{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewModal(b)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-line text-ink hover:border-ink transition-colors"
                          title="View details"
                          aria-label={`View booking ${b.invoiceNumber}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => generatePDF(b, b.car)}
                          type="button"
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-line text-ink hover:border-ink transition-colors"
                          title="Download invoice PDF"
                          aria-label={`Download invoice ${b.invoiceNumber}`}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => sendWhatsAppInvoice(b, b.car)}
                          type="button"
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-line text-ink hover:border-ink transition-colors"
                          title="Send invoice on WhatsApp"
                          aria-label={`Send invoice ${b.invoiceNumber} on WhatsApp`}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(b._id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-line text-danger hover:border-danger hover:bg-danger/10 transition-colors"
                          title="Delete booking"
                          aria-label={`Delete booking ${b.invoiceNumber}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-line">
              <p className="text-muted text-xs font-medium">{total} total • Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-line text-muted text-xs font-semibold disabled:opacity-30 hover:border-ink hover:text-ink transition-colors"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-line text-muted text-xs font-semibold disabled:opacity-30 hover:border-ink hover:text-ink transition-colors"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-raised p-4 rounded-xl border border-line">
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
                ['Payment Status', viewModal.paymentCompleted ? 'Paid' : 'Pending'],
                ['Driver License', viewModal.licenseNumber],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-muted text-xs font-bold uppercase tracking-wider">{k}</p>
                  <p className="text-ink font-semibold mt-0.5">{v || '—'}</p>
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
