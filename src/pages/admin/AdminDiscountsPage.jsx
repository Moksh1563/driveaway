/**
 * ============================================================================
 * ADMIN DISCOUNTS & PROMOTIONAL ALERTS PAGE
 * ============================================================================
 * Allows administrative staff to:
 *  1. View high-level metrics (active promo codes, newsletter subscribers, users)
 *  2. Create new discount coupons with percentage caps & immediate broadcast
 *  3. Toggle coupon activation status (Active / Inactive)
 *  4. Broadcast promotional email campaigns to all users & subscribers
 *  5. Copy codes with a single click and delete expired coupons
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, Send, Plus, Trash2, CheckCircle2, AlertCircle, Loader2, Users, Bell, Sparkles, Copy, Check } from 'lucide-react';
import api from '../../api/axios';

export default function AdminDiscountsPage() {

  const [discounts, setDiscounts] = useState([]);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState('');

  // New discount form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    percentageOff: '',
    maxDiscount: '',
    isActive: true,
    notifyUsers: false,
    customMessage: '',
  });
  const [formLoading, setFormLoading] = useState(false);

  // Broadcast modal
  const [broadcastTarget, setBroadcastTarget] = useState(null);
  const [customBroadcastMsg, setCustomBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  // Notifications
  const [alert, setAlert] = useState({ type: '', message: '' });

  const fetchDiscounts = async () => {
    try {
      const { data } = await api.get('/discount');
      setDiscounts(data.discounts || []);
      setSubscriberCount(data.subscriberCount || 0);
      setUserCount(data.userCount || 0);
    } catch (err) {
      console.error(err);
      showAlert('error', 'Failed to load discounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert({ type: '', message: '' }), 5000);
  };

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.code || !formData.percentageOff) {
      showAlert('error', 'Please provide a promo code and discount percentage.');
      return;
    }

    setFormLoading(true);
    try {
      const { data } = await api.post('/discount', formData);
      showAlert('success', data.message || 'Promo code created successfully!');
      setShowForm(false);
      setFormData({
        code: '',
        percentageOff: '',
        maxDiscount: '',
        isActive: true,
        notifyUsers: false,
        customMessage: '',
      });
      fetchDiscounts();
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Error creating promo code.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      const { data } = await api.patch(`/discount/${id}/toggle`);
      showAlert('success', data.message);
      fetchDiscounts();
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Error updating status.');
    }
  };

  const handleDelete = async (id, code) => {
    if (!window.confirm(`Are you sure you want to delete promo code "${code}"?`)) return;
    try {
      const { data } = await api.delete(`/discount/${id}`);
      showAlert('success', data.message);
      fetchDiscounts();
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Error deleting promo code.');
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastTarget) return;
    setBroadcasting(true);
    try {
      const { data } = await api.post(`/discount/broadcast/${broadcastTarget._id}`, {
        customMessage: customBroadcastMsg,
      });
      showAlert('success', data.message || `Dispatched to ${data.broadcastCount} recipients!`);
      setBroadcastTarget(null);
      setCustomBroadcastMsg('');
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to broadcast discount.');
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2.5">
            <Tag className="w-7 h-7 text-amber-500" />
            Discounts & Alerts
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Manage promotional coupon codes and broadcast discount notifications to users & subscribers.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm px-4 py-2.5 rounded-xl transition-all shadow-md shadow-amber-500/20"
        >
          {showForm ? 'Cancel' : <><Plus className="w-4 h-4" /> Create Promo Code</>}
        </button>
      </div>

      {/* Alert Banner */}
      {alert.message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl flex items-center gap-2.5 text-sm font-semibold ${
            alert.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400'
          }`}
        >
          {alert.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <span>{alert.message}</span>
        </motion.div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/5 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Promo Codes</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white mt-2">{discounts.length}</div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {discounts.filter(d => d.isActive).length} currently active
          </p>
        </div>

        <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/5 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Discount Subscribers</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white mt-2">{subscriberCount}</div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Opted-in for discount emails</p>
        </div>

        <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/5 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Registered Users</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white mt-2">{userCount}</div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Eligible for discount broadcasts</p>
        </div>
      </div>

      {/* Create Promo Code Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm overflow-hidden"
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Create & Broadcast New Discount Code
            </h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                    Promo Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FESTIVE20"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm uppercase font-mono font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                    Discount Percentage (%) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    placeholder="e.g. 20"
                    value={formData.percentageOff}
                    onChange={(e) => setFormData({ ...formData, percentageOff: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                    Max Discount (₹, Optional)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 3000 (No cap if empty)"
                    value={formData.maxDiscount}
                    onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Broadcast Checkbox */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.notifyUsers}
                    onChange={(e) => setFormData({ ...formData, notifyUsers: e.target.checked })}
                    className="w-4 h-4 text-amber-500 rounded border-gray-300 focus:ring-amber-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Send className="w-4 h-4 text-amber-500" />
                      Broadcast to all users & subscribers immediately via email
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Sends high-priority announcement emails to all registered accounts and discount subscribers.
                    </span>
                  </div>
                </label>

                {formData.notifyUsers && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                      Custom Email Announcement Message (Optional)
                    </label>
                    <textarea
                      rows="2"
                      placeholder="e.g. Special weekend offer! Rent your favourite hypercar or SUV and enjoy 20% off."
                      value={formData.customMessage}
                      onChange={(e) => setFormData({ ...formData, customMessage: e.target.value })}
                      className="w-full bg-white dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </motion.div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm px-6 py-2.5 rounded-xl transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Save Promo Code
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discounts List */}
      <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Active Promo Codes</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">{discounts.length} codes registered</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-500">Loading discount codes...</div>
        ) : discounts.length === 0 ? (
          <div className="py-16 text-center text-gray-500 dark:text-gray-400">
            No promo codes created yet. Click "Create Promo Code" to get started!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-white/[0.02] text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-white/5">
                <tr>
                  <th className="py-3.5 px-5">Promo Code</th>
                  <th className="py-3.5 px-5">Discount</th>
                  <th className="py-3.5 px-5">Max Cap</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Created</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {discounts.map((discount) => (
                  <tr key={discount._id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.01] transition-colors">
                    {/* Code */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-base text-gray-900 dark:text-white tracking-wide bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                          {discount.code}
                        </span>
                        <button
                          onClick={() => handleCopy(discount.code)}
                          className="p-1.5 text-gray-400 hover:text-amber-500 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                          title="Copy Code"
                        >
                          {copiedCode === discount.code ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>

                    {/* Discount */}
                    <td className="py-4 px-5 font-bold text-emerald-600 dark:text-emerald-400">
                      {discount.percentageOff}% OFF
                    </td>

                    {/* Max Discount */}
                    <td className="py-4 px-5 text-gray-600 dark:text-gray-300 font-medium">
                      {discount.maxDiscount ? `₹${discount.maxDiscount.toLocaleString('en-IN')}` : 'No limit'}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-5">
                      <button
                        onClick={() => handleToggle(discount._id)}
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full cursor-pointer transition-all ${
                          discount.isActive
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'bg-gray-100 dark:bg-white/5 text-gray-500 border border-gray-200 dark:border-white/10 hover:bg-gray-200'
                        }`}
                        title="Click to toggle status"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${discount.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {discount.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    {/* Created */}
                    <td className="py-4 px-5 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(discount.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Broadcast Button */}
                        <button
                          onClick={() => setBroadcastTarget(discount)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/25 rounded-lg text-xs font-extrabold transition-all"
                          title="Broadcast email notification to users"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Broadcast</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(discount._id, discount.code)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          title="Delete Code"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Broadcast Modal */}
      <AnimatePresence>
        {broadcastTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/10 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-500/15 text-amber-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Send className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">
                    Broadcast Promo Code
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Notify all registered users & newsletter subscribers via email
                  </p>
                </div>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-lg text-amber-600 dark:text-amber-400">{broadcastTarget.code}</span>
                  <span className="font-extrabold text-sm text-gray-900 dark:text-white">{broadcastTarget.percentageOff}% OFF</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Reaching approximately <strong>{userCount + subscriberCount}</strong> recipients in Ahmedabad.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Custom Headline or Note (Optional)
                </label>
                <textarea
                  rows="3"
                  value={customBroadcastMsg}
                  onChange={(e) => setCustomBroadcastMsg(e.target.value)}
                  placeholder="e.g. Grab 20% off all supercars and SUVs this weekend! Book now before vehicles run out."
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBroadcastTarget(null)}
                  className="px-4 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={broadcasting}
                  onClick={handleBroadcast}
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm px-6 py-2.5 rounded-xl transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {broadcasting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Dispatching Emails...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Broadcast Now
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
