import React, { useState, useEffect } from 'react';
import { Search, Trash2, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteModal, setDeleteModal] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/users/${deleteModal._id}`);
      toast.success('User deleted successfully');
      setDeleteModal(null);
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete user'); }
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-wide font-black uppercase tracking-tight text-2xl sm:text-3xl">Customers</h1>
        <p className="text-muted text-sm mt-1">{users.length} registered customers in Ahmedabad</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by customer name or email..."
          className="w-full bg-raised border border-line rounded-chip pl-10 pr-4 py-3 text-ink text-sm outline-none focus:ring-2 focus:ring-ink/30 "
        />
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-surface border border-line rounded-chip overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-xs uppercase font-bold tracking-wider border-b border-line">
                  {['User', 'Phone', 'Driving License', 'Loyalty Balance', 'Joined Date', 'Actions'].map(h => (
                    <th key={h} className="text-left p-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map(user => (
                  <tr key={user._id} className="hover:bg-ink/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-ink/20 rounded-full flex items-center justify-center text-ink font-bold text-sm flex-shrink-0">
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
                        <Gift className="w-3.5 h-3.5 text-ink" />
                        <span className="text-ink dark:text-ink font-bold">{user.loyaltyPoints || 0} pts</span>
                        <span className="text-muted text-xs">(₹{((user.loyaltyPoints || 0) / 10).toFixed(0)})</span>
                      </div>
                    </td>
                    <td className="p-4 text-muted text-xs font-medium">
                      {new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => setDeleteModal(user)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted">No users found matching search</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Customer Account" size="sm">
        <p className="text-muted mb-5 text-sm">
          Are you sure you want to delete user <span className="text-ink font-bold">{deleteModal?.name}</span>?
          All profile and booking data will be deleted permanently.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => setDeleteModal(null)} className="flex-1">Cancel</Button>
          <Button variant="danger" onClick={handleDelete} className="flex-1">Delete User</Button>
        </div>
      </Modal>
    </div>
  );
}
