import React, { useState, useEffect, useCallback } from 'react';
import { Search, Download, MessageCircle, Eye, Trash2, Banknote } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import LoadError from '../../components/admin/LoadError';
import { generatePDF, sendWhatsAppInvoice } from '../../components/invoice/InvoiceGenerator';
import { TableSkeleton } from '../../components/ui/Skeletons';
import { paymentLabel, paymentRef } from '../../utils/payment';
import useDebounced from '../../hooks/useDebounced';

const STATUSES = ['All', 'Pending', 'Confirmed', 'Completed', 'Cancelled'];

// Mirrors the server's transition table; used only when an older API omits allowedNextStatuses
const NEXT_STATUSES = { Pending: ['Confirmed', 'Cancelled'], Confirmed: ['Completed', 'Cancelled'], Completed: [], Cancelled: [] };
const ACTION_LABEL = { Confirmed: 'Confirm', Completed: 'Complete', Cancelled: 'Cancel' };
const ACTION_TITLE = { Confirmed: 'Confirm booking', Completed: 'Complete booking', Cancelled: 'Cancel booking' };

// Trip dates are calendar days in India time
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }) : '');
const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const nextStatuses = (b) => (Array.isArray(b.allowedNextStatuses) ? b.allowedNextStatuses : NEXT_STATUSES[b.status] || []);
const isCashBooking = (b) => !b.paymentMethod || b.paymentMethod === 'Cash';
const canRecordCash = (b) => !b.paymentCompleted && b.status !== 'Cancelled';
const coversNow = (b) => {
  const now = Date.now();
  return new Date(b.pickupDate).getTime() <= now && new Date(b.returnDate).getTime() > now;
};

/** What a confirmed action will do, in plain words, so the admin decides knowing the consequences. */
function actionDetails({ kind, booking: b, status }) {
  const name = b.user?.name || b.customerName || 'The customer';
  // Booking emails go to the account email, not the free-text contact email
  const emailed = (what) => (b.user?.email
    ? `${name} gets an email at ${b.user.email} saying ${what}.`
    : 'No account email is on file, so no email is sent.');
  const car = b.car?.name || 'The car';
  // Points are credited on completion, once; bookings made before that rule carry no pointsAwarded flag
  const points = Math.floor((Number(b.totalAmount) || 0) / 100);
  const paidAmount = money(b.paidAmount ?? b.totalAmount);

  // The shared cancellation steps (also run when an active booking is deleted)
  const cancellationLines = () => [
    emailed('the booking is cancelled'),
    b.loyaltyPointsUsed > 0 && `The ${b.loyaltyPointsUsed} loyalty points they used go back to their account.`,
    b.discountCode && b.discountClaimed && `The use of code ${b.discountCode} is released.`,
    b.paymentCompleted && !b.refundedAt && (isCashBooking(b)
      ? `The ${paidAmount} cash payment is marked refunded and leaves collected revenue. Return the cash to the customer.`
      : `The ${paidAmount} online payment is marked refunded and leaves collected revenue.`),
    `${car} becomes bookable again for ${fmtDate(b.pickupDate)} to ${fmtDate(b.returnDate)}.`,
    coversNow(b) && 'Customers waiting for an availability alert are emailed if no other booking covers today.',
  ];

  if (kind === 'cash') {
    return {
      title: 'Record cash payment',
      confirmLabel: 'Record cash',
      lines: [
        `${money(b.totalAmount)} is recorded as paid in cash and counts towards collected revenue.`,
        b.status === 'Pending' && 'The booking is confirmed at the same time.',
        b.user?.email ? `${name} is emailed a payment receipt at ${b.user.email}.` : 'No account email is on file, so no receipt is emailed.',
      ],
    };
  }

  if (kind === 'delete') {
    const active = ['Pending', 'Confirmed'].includes(b.status);
    return {
      title: 'Delete booking',
      confirmLabel: 'Delete booking',
      danger: true,
      lines: active
        ? [
          'This booking is still active, so it is cancelled first:',
          ...cancellationLines(),
          'Then the booking and its invoice record are removed for good. This cannot be undone.',
        ]
        : [
          'The booking and its invoice record are removed for good. This cannot be undone.',
          b.paymentCompleted && !b.refundedAt && `Its ${paidAmount} payment no longer counts towards collected revenue.`,
        ],
    };
  }

  if (status === 'Confirmed') {
    return {
      title: ACTION_TITLE.Confirmed,
      confirmLabel: 'Yes, confirm',
      cancelLabel: 'Keep as is',
      lines: [
        emailed('the booking is confirmed'),
        !b.paymentCompleted && (isCashBooking(b)
          ? 'It stays unpaid until the cash is collected. Use "Mark cash collected" at pickup.'
          : 'It is unpaid, and once confirmed the customer can no longer pay online. Collect payment at pickup with "Mark cash collected".'),
      ],
    };
  }

  if (status === 'Completed') {
    return {
      title: ACTION_TITLE.Completed,
      confirmLabel: 'Yes, complete',
      cancelLabel: 'Keep as is',
      lines: [
        emailed('the trip is complete, with an invitation to leave a review'),
        b.pointsAwarded === false && points > 0 && `They earn ${points} loyalty points.`,
        !b.paymentCompleted && `It is unpaid, so ${money(b.totalAmount)} is recorded as cash collected at the hub.`,
        coversNow(b) && `${car} is free again from today; customers waiting for an availability alert are emailed if no other booking covers today.`,
        'This is final: a completed booking cannot be changed again.',
      ],
    };
  }

  // Cancelled
  return {
    title: ACTION_TITLE.Cancelled,
    confirmLabel: 'Yes, cancel booking',
    cancelLabel: 'Keep booking',
    danger: true,
    lines: [
      ...cancellationLines(),
      'This is final: a cancelled booking cannot be reopened.',
    ],
  };
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim());
  // One state object, so a new search and its page reset trigger a single request
  const [filters, setFilters] = useState({ q: '', status: 'All', page: 1 });
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [viewModal, setViewModal] = useState(null);
  // { kind: 'status' | 'cash' | 'delete', booking, status? } awaiting confirmation
  const [action, setAction] = useState(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    setFilters(prev => (prev.q === query ? prev : { ...prev, q: query, page: 1 }));
  }, [query]);

  // Abort the previous request when filters change, so a slow reply can never overwrite a newer one
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const params = { page: filters.page, limit: 10 };
    if (filters.q) params.search = filters.q;
    if (filters.status !== 'All') params.status = filters.status;

    api.get('/bookings', { params, signal: controller.signal })
      .then(({ data }) => {
        const list = data.bookings || [];
        const pages = data.totalPages || 1;
        // The last row of the last page was removed: step back a page
        if (filters.page > pages && filters.page > 1) {
          setFilters(prev => ({ ...prev, page: pages }));
          return;
        }
        setBookings(list);
        setTotalPages(pages);
        setTotal(data.total || 0);
        setLoaded(true);
        setViewModal(prev => (prev ? list.find(b => b._id === prev._id) || prev : prev));
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setError(err.response?.data?.message || 'Could not load bookings.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [filters, reloadKey]);

  const reload = () => setReloadKey(k => k + 1);

  const openAction = (next) => { setActionError(''); setAction(next); };
  const closeAction = useCallback(() => setAction(null), []);

  const runAction = async () => {
    if (!action) return;
    const { kind, booking: b, status } = action;
    setActing(true);
    setActionError('');
    try {
      if (kind === 'status') {
        await api.patch(`/bookings/${b._id}/status`, { status });
        toast.success(`${b.invoiceNumber} is now ${status}`);
      } else if (kind === 'cash') {
        const { data } = await api.patch(`/bookings/${b._id}/payment`, { method: 'CASH' });
        const nowStatus = data?.status && data.status !== b.status ? ` It is now ${data.status}.` : '';
        toast.success(`Cash payment recorded for ${b.invoiceNumber}.${nowStatus}`);
      } else if (kind === 'delete') {
        await api.delete(`/bookings/${b._id}`);
        toast.success('Booking deleted');
        setViewModal(prev => (prev?._id === b._id ? null : prev));
      }
      setAction(null);
      reload();
    } catch (err) {
      setActionError(err.response?.data?.message || 'That did not work. Please try again.');
    } finally {
      setActing(false);
    }
  };

  const details = action ? actionDetails(action) : null;
  const actionBooking = action?.booking;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-wide font-black uppercase tracking-tight text-2xl sm:text-3xl">Bookings</h1>
          <p className="text-muted text-sm mt-1">{total} {total === 1 ? 'booking' : 'bookings'} recorded across Ahmedabad hubs</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search bookings"
            placeholder="Search by invoice number, driver name, email..."
            className="w-full bg-raised border border-line rounded-chip pl-10 pr-4 py-3 text-ink text-sm outline-none focus:ring-2 focus:ring-ink/30 "
          />
        </div>
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter by status">
          {STATUSES.map(s => (
            <button
              key={s}
              type="button"
              aria-pressed={filters.status === s}
              onClick={() => setFilters(prev => ({ ...prev, status: s, page: 1 }))}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-[color,background-color,border-color,opacity,box-shadow,transform] ${
 filters.status === s
 ? 'bg-ink border-ink text-ground shadow-sm'
 : 'bg-raised border-line text-muted hover:border-ink'
 }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && loaded && <LoadError message={error} onRetry={reload} />}

      {!loaded && loading ? <TableSkeleton cols={6} /> : !loaded && error ? (
        <LoadError message={error} onRetry={reload} />
      ) : (
        <div className="bg-surface border border-line rounded-chip overflow-hidden shadow-sm">
          <div className={`overflow-x-auto transition-opacity duration-150 ${loading ? 'opacity-60' : ''}`} aria-busy={loading || undefined}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-xs uppercase font-bold tracking-wider border-b border-line">
                  {['Invoice', 'Customer', 'Car', 'Trip Dates', 'Amount', 'Status', 'Actions'].map(h => (
                    <th key={h} scope="col" className="text-left p-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {bookings.map(b => {
                  const next = nextStatuses(b);
                  return (
                    <tr key={b._id} className="hover:bg-ink/5 transition-colors">
                      <td className="p-4 font-mono text-ink font-bold text-xs">{b.invoiceNumber}</td>
                      <td className="p-4">
                        <p className="text-ink font-bold">{b.user?.name || b.customerName}</p>
                        <p className="text-muted text-xs">{b.user?.email || b.customerEmail}</p>
                      </td>
                      <td className="p-4 text-muted font-medium">{b.car?.name}</td>
                      <td className="p-4 text-muted text-xs font-medium whitespace-nowrap">
                        {fmtDate(b.pickupDate)}<br />
                        → {fmtDate(b.returnDate)}
                      </td>
                      <td className="p-4">
                        <p className="text-ink font-extrabold">{money(b.totalAmount)}</p>
                        {b.paymentCompleted ? (
                          <p className="text-ok text-xs font-bold">
                            {b.refundedAt ? 'Refunded' : 'Paid'} · {paymentLabel(b.paymentMethod)}
                          </p>
                        ) : (
                          <p className="text-warn text-xs font-bold">
                            Unpaid · {isCashBooking(b) ? 'Cash at pickup' : paymentLabel(b.paymentMethod)}
                          </p>
                        )}
                        {canRecordCash(b) && (
                          <button
                            type="button"
                            onClick={() => openAction({ kind: 'cash', booking: b })}
                            aria-label={`Mark cash collected for ${b.invoiceNumber}`}
                            className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-ink hover:border-ink transition-colors whitespace-nowrap"
                          >
                            <Banknote className="w-3.5 h-3.5" aria-hidden="true" /> Mark cash collected
                          </button>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge status={b.status} />
                        {next.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {next.map(s => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => openAction({ kind: 'status', booking: b, status: s })}
                                aria-label={`${ACTION_TITLE[s] || `Mark as ${s}`}: ${b.invoiceNumber}`}
                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                                  s === 'Cancelled'
                                    ? 'border-line text-danger hover:border-danger hover:bg-danger/10'
                                    : 'border-line text-ink hover:border-ink'
                                }`}
                              >
                                {ACTION_LABEL[s] || s}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewModal(b)}
                            className="hit-area w-8 h-8 flex items-center justify-center rounded-lg border border-line text-ink hover:border-ink transition-colors"
                            title="View details"
                            aria-label={`View booking ${b.invoiceNumber}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => generatePDF(b, b.car)}
                            type="button"
                            className="hit-area w-8 h-8 flex items-center justify-center rounded-lg border border-line text-ink hover:border-ink transition-colors"
                            title="Download invoice PDF"
                            aria-label={`Download invoice ${b.invoiceNumber}`}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => sendWhatsAppInvoice(b, b.car)}
                            type="button"
                            className="hit-area w-8 h-8 flex items-center justify-center rounded-lg border border-line text-ink hover:border-ink transition-colors"
                            title="Send invoice on WhatsApp"
                            aria-label={`Send invoice ${b.invoiceNumber} on WhatsApp`}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openAction({ kind: 'delete', booking: b })}
                            className="hit-area w-8 h-8 flex items-center justify-center rounded-lg border border-line text-danger hover:border-danger hover:bg-danger/10 transition-colors"
                            title="Delete booking"
                            aria-label={`Delete booking ${b.invoiceNumber}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted">
                      {filters.q || filters.status !== 'All' ? 'No bookings match these filters.' : 'No bookings yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-line">
              <p className="text-muted text-xs font-medium">{total} total • Page {filters.page} of {totalPages}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={filters.page <= 1}
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                  className="px-3 py-1.5 rounded-lg border border-line text-muted text-xs font-semibold disabled:opacity-30 hover:border-ink hover:text-ink transition-colors"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={filters.page >= totalPages}
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                  className="px-3 py-1.5 rounded-lg border border-line text-muted text-xs font-semibold disabled:opacity-30 hover:border-ink hover:text-ink transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm a status change, cash payment or deletion */}
      <ConfirmDialog
        isOpen={!!action}
        onClose={closeAction}
        onConfirm={runAction}
        title={details?.title}
        confirmLabel={details?.confirmLabel}
        cancelLabel={details?.cancelLabel}
        danger={details?.danger}
        loading={acting}
        error={actionError}
      >
        {actionBooking && (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-line bg-raised p-3.5 text-xs">
              <div>
                <dt className="text-muted font-bold uppercase tracking-wider">Invoice</dt>
                <dd className="font-mono font-bold text-ink mt-0.5">{actionBooking.invoiceNumber}</dd>
              </div>
              <div>
                <dt className="text-muted font-bold uppercase tracking-wider">Customer</dt>
                <dd className="font-semibold text-ink mt-0.5">{actionBooking.user?.name || actionBooking.customerName || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted font-bold uppercase tracking-wider">Car</dt>
                <dd className="font-semibold text-ink mt-0.5">{actionBooking.car?.name || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted font-bold uppercase tracking-wider">Amount</dt>
                <dd className="font-semibold text-ink mt-0.5">
                  {money(actionBooking.totalAmount)} · {actionBooking.paymentCompleted ? 'paid' : 'unpaid'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted font-bold uppercase tracking-wider">Trip</dt>
                <dd className="font-semibold text-ink mt-0.5">{fmtDate(actionBooking.pickupDate)} → {fmtDate(actionBooking.returnDate)}</dd>
              </div>
            </dl>
            <ul className="list-disc space-y-1.5 pl-5 text-muted">
              {details.lines.filter(Boolean).map(line => <li key={line}>{line}</li>)}
            </ul>
          </>
        )}
      </ConfirmDialog>

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
                ['Account Email', viewModal.user?.email],
                ['Contact Email', viewModal.customerEmail],
                ['Phone', viewModal.customerPhone],
                ['Pickup Location', viewModal.pickupLocation],
                ['Pickup Date', fmtDate(viewModal.pickupDate)],
                ['Return Date', fmtDate(viewModal.returnDate)],
                ['Duration', viewModal.totalDays ? `${viewModal.totalDays} ${viewModal.totalDays === 1 ? 'Day' : 'Days'}` : ''],
                ['Daily Rate', viewModal.dailyRateSnapshot != null ? money(viewModal.dailyRateSnapshot) : ''],
                ['Discount Applied', viewModal.discountAmount > 0 ? `-${money(viewModal.discountAmount)} (${viewModal.discountCode})` : 'None'],
                ['Loyalty Points', viewModal.loyaltyPointsUsed > 0
                  ? `${viewModal.loyaltyPointsUsed} pts used${viewModal.loyaltyDiscount > 0 ? ` (-${money(viewModal.loyaltyDiscount)})` : ''}`
                  : 'None'],
                ['Points Earned', viewModal.pointsAwarded && viewModal.loyaltyPointsEarned > 0 ? `${viewModal.loyaltyPointsEarned} pts` : ''],
                ['Final Total Amount', money(viewModal.totalAmount)],
                ['Payment Method', paymentLabel(viewModal.paymentMethod)],
                ['Payment Status', viewModal.refundedAt ? `Refunded ${fmtDate(viewModal.refundedAt)}` : viewModal.paymentCompleted ? 'Paid' : 'Unpaid'],
                ['Amount Paid', viewModal.paymentCompleted ? money(viewModal.paidAmount ?? viewModal.totalAmount) : ''],
                ['Paid On', viewModal.paymentCompletedAt ? fmtDate(viewModal.paymentCompletedAt) : ''],
                ['Payment Reference', paymentRef(viewModal.paymentId)],
                ['Driver License', viewModal.licenseNumber],
                ...(viewModal.status === 'Cancelled'
                  ? [['Cancellation', [viewModal.cancellationReason, viewModal.cancelledBy && `by ${viewModal.cancelledBy}`, viewModal.cancelledAt && fmtDate(viewModal.cancelledAt)].filter(Boolean).join(' · ')]]
                  : []),
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-muted text-xs font-bold uppercase tracking-wider">{k}</p>
                  <p className="text-ink font-semibold mt-0.5 [overflow-wrap:anywhere]">{v || '—'}</p>
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
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-[color,background-color,border-color,opacity,box-shadow,transform] text-sm shadow-sm"
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
