import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { Search, Trash2, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import LoadError from '../../components/admin/LoadError';
import { TableSkeleton } from '../../components/ui/Skeletons';
import { EASE, listItem } from '../../theme/motion';
import useDebounced from '../../hooks/useDebounced';

// Search filters this list quietly: the query settles first (debounced), rows that drop out leave at
// once, the rows below glide up together a single time, and rows that match again fade back in.
// Only a deleted customer's row fades away (AnimatePresence hands each leaving row the deleted id as
// `custom`). Reduced motion: instant.
const ROW_TRANSITION = { layout: { duration: 0.3, ease: EASE.out } };
const DROP_AT_ONCE = { opacity: 0, transition: { duration: 0 } };
const rowExit = (id) => (deletedId) => (deletedId === id ? listItem.exit : DROP_AT_ONCE);
// Skeleton → table: the loaded list fades in where the skeleton was (once; searches don't replay it)
const viewIn = { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2, ease: EASE.out } } };

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // The customer just deleted (so only that row fades out) and a count of finished row exits (rowsKey)
  const [deletedId, setDeletedId] = useState(null);
  const [exitsDone, setExitsDone] = useState(0);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/users');
      setUsers(Array.isArray(data) ? data : data?.users || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load customers.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openDelete = (user) => { setDeleteError(''); setDeleteModal(user); };
  const closeDelete = useCallback(() => setDeleteModal(null), []);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      const { data } = await api.delete(`/admin/users/${deleteModal._id}`);
      const done = [
        Number.isFinite(data?.anonymisedBookings) && `${data.anonymisedBookings} past booking${data.anonymisedBookings === 1 ? '' : 's'} anonymised`,
        Number.isFinite(data?.removedReviews) && `${data.removedReviews} review${data.removedReviews === 1 ? '' : 's'} removed`,
      ].filter(Boolean);
      toast.success(`Customer account deleted${done.length ? `. ${done.join(', ')}.` : ''}`);
      setDeletedId(deleteModal._id);
      setUsers(prev => prev.filter(u => u._id !== deleteModal._id));
      setDeleteModal(null);
      fetchUsers();
    } catch (err) {
      // 409: the customer still has upcoming or ongoing bookings; the server says which
      setDeleteError(err.response?.data?.message || 'Failed to delete this customer.');
    } finally {
      setDeleting(false);
    }
  };

  const q = useDebounced(search.trim().toLowerCase());
  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(q) ||
    u.email?.toLowerCase().includes(q)
  );
  // Rows measure their layout only when this changes: the visible rows, or a leaving row finally
  // gone (exitsDone ticks in the same render that removes it, so the rest glide up once)
  const rowsKey = `${filtered.map(u => u._id).join('|')}#${exitsDone}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-wide font-black uppercase tracking-tight text-2xl sm:text-3xl">Customers</h1>
        <p className="text-muted text-sm mt-1">{users.length} registered {users.length === 1 ? 'customer' : 'customers'} in Ahmedabad</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search customers"
          placeholder="Search by customer name or email..."
          className="w-full bg-raised border border-line rounded-chip pl-10 pr-4 py-3 text-ink text-sm outline-none focus:ring-2 focus:ring-ink/30 "
        />
      </div>

      {loading && users.length === 0 ? <TableSkeleton cols={5} /> : error && users.length === 0 ? (
        <LoadError message={error} onRetry={fetchUsers} />
      ) : (
        <>
          {error && <LoadError message={error} onRetry={fetchUsers} />}
          <m.div {...viewIn} className="bg-surface border border-line rounded-chip overflow-hidden shadow-sm">
            <div className={`overflow-x-auto transition-opacity duration-150 ${loading ? 'opacity-60' : ''}`} aria-busy={loading || undefined}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted text-xs uppercase font-bold tracking-wider border-b border-line">
                    {['User', 'Phone', 'Driving License', 'Loyalty Balance', 'Joined Date', 'Actions'].map(h => (
                      <th key={h} scope="col" className="text-left p-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  <AnimatePresence initial={false} custom={deletedId} onExitComplete={() => setExitsDone(n => n + 1)}>
                  {filtered.map(user => (
                    <m.tr key={user._id} layout="position" layoutDependency={rowsKey} {...listItem} exit={rowExit(user._id)} transition={ROW_TRANSITION} className="hover:bg-ink/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-ink/20 rounded-full flex items-center justify-center text-ink font-bold text-sm flex-shrink-0" aria-hidden="true">
                            {user.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-ink font-bold">{user.name}</p>
                            <p className="text-muted text-xs">{user.email}</p>
                            {user.address && <p className="text-muted text-xs truncate max-w-[160px]">{user.address}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-muted font-medium">{user.phone || '—'}</td>
                      <td className="p-4 text-muted font-mono text-xs font-semibold">{user.licenseNumber || '—'}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <Gift className="w-3.5 h-3.5 text-ink" aria-hidden="true" />
                          <span className="text-ink dark:text-ink font-bold">{user.loyaltyPoints || 0} pts</span>
                          <span className="text-muted text-xs">(₹{((user.loyaltyPoints || 0) / 10).toFixed(0)})</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted text-xs font-medium">
                        {new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => openDelete(user)}
                          aria-label={`Delete ${user.name || user.email}`}
                          title="Delete customer"
                          className="hit-area w-8 h-8 flex items-center justify-center rounded-lg border border-line text-danger hover:border-danger hover:bg-danger/10 transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.96]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </m.tr>
                  ))}
                  </AnimatePresence>
                  {filtered.length === 0 && (
                    <m.tr initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.2, ease: EASE.out } }}>
                      <td colSpan={6} className="p-8 text-center text-muted">{users.length ? 'No users found matching search' : 'No customers yet.'}</td>
                    </m.tr>
                  )}
                </tbody>
              </table>
            </div>
          </m.div>
        </>
      )}

      <ConfirmDialog
        isOpen={!!deleteModal}
        onClose={closeDelete}
        onConfirm={handleDelete}
        title="Delete Customer Account"
        confirmLabel="Delete account"
        cancelLabel="Cancel"
        danger
        loading={deleting}
        error={deleteError}
      >
        <p className="text-muted">
          Delete the account of <span className="text-ink font-bold">{deleteModal?.name}</span>
          {deleteModal?.email ? <> ({deleteModal.email})</> : null}? This cannot be undone.
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-muted">
          <li>An account with pending or confirmed bookings that have not ended yet cannot be deleted. Cancel or complete those first.</li>
          <li>Their reviews are removed and those cars&apos; ratings are recalculated. Their availability alerts and discount-email subscription are removed too.</li>
          <li>Past bookings stay for the business records, with the name replaced by &quot;Deleted customer&quot; and the contact, licence, ID, address and date-of-birth details erased.</li>
        </ul>
      </ConfirmDialog>
    </div>
  );
}
