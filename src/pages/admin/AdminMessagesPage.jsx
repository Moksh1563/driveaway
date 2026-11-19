import React, { useState, useEffect } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { Mail, Phone, CheckCheck, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { TableSkeleton } from '../../components/ui/Skeletons';
import LoadError from '../../components/admin/LoadError';
import { EASE, listItem, SPRING } from '../../theme/motion';

// Inbox list: switching All / Unread / Read, messages that leave fade out on top while the rest
// glide into place (popLayout), and messages that join fade in.
const ITEM_TRANSITION = { layout: { duration: 0.3, ease: EASE.out } };
// Reading pane: the newly chosen message (or the placeholder) cross-fades over the last one
const paneSwap = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE.out } },
  exit: { opacity: 0, transition: { duration: 0.14, ease: EASE.in } },
};
// Loading → inbox: the loaded view fades in over where the skeleton was
const viewIn = { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2, ease: EASE.out } } };

// Visitor-typed values go into mailto:/tel: links encoded, so a crafted subject or address cannot add cc/bcc/body
const mailtoAddress = (email) => encodeURIComponent(String(email || '').trim()).replace(/%40/g, '@');
const replyHref = (msg) => {
  const subject = `Re: ${String(msg.subject || 'Your inquiry at Driveaway').replace(/[\r\n]+/g, ' ')}`;
  return `mailto:${mailtoAddress(msg.email)}?subject=${encodeURIComponent(subject)}`;
};
const telHref = (phone) => `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'read'
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { fetchMessages(); }, []);

  const fetchMessages = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/messages');
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load messages.');
    }
    finally { setLoading(false); }
  };

  const markRead = async (id) => {
    try {
      const { data } = await api.patch(`/admin/messages/${id}/read`);
      setMessages(prev => prev.map(msg => msg._id === id ? data : msg));
      if (selected?._id === id) setSelected(data);
    } catch { toast.error('Failed to mark as read'); }
  };

  const handleSelect = (msg) => {
    setSelected(msg);
    if (!msg.isRead) markRead(msg._id);
  };

  const filtered = messages.filter(msg => {
    if (filter === 'unread') return !msg.isRead;
    if (filter === 'read') return msg.isRead;
    return true;
  });

  const unreadCount = messages.filter(msg => !msg.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-wide font-black uppercase tracking-tight text-2xl sm:text-3xl">Inquiries</h1>
          <p className="text-muted text-sm mt-1">{messages.length} total messages • {unreadCount} unread</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: `All (${messages.length})` },
          { key: 'unread', label: `Unread (${unreadCount})` },
          { key: 'read', label: `Read (${messages.length - unreadCount})` },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`relative px-4 py-2 rounded-xl text-xs font-bold border bg-raised transition-[color,background-color,border-color,opacity,box-shadow,transform] duration-200 ease-out active:scale-[0.98] ${
 filter === f.key
 ? 'border-ink text-ground shadow-sm'
 : 'border-line text-muted hover:border-ink'
 }`}
          >
            {/* The ink fill slides to the chosen tab, like a segmented control */}
            {filter === f.key && (
              <m.span layoutId="admin-inbox-filter" transition={SPRING} className="absolute inset-0 rounded-[11px] bg-ink" aria-hidden="true" />
            )}
            <span className="relative">{f.label}</span>
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton cols={4} /> : error ? <LoadError message={error} onRetry={fetchMessages} /> : (
        <m.div {...viewIn} className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[500px]">
          {/* Message list */}
          <div className="relative lg:col-span-2 flex flex-col gap-2.5">
            <AnimatePresence mode="popLayout" initial={false}>
            {filtered.length === 0 ? (
              <m.div key="empty" {...listItem} className="bg-surface border border-line rounded-chip p-8 text-center shadow-sm">
                <Inbox className="w-10 h-10 text-muted mx-auto mb-3" />
                <p className="text-muted text-sm font-medium">No messages found</p>
              </m.div>
            ) : filtered.map(msg => (
              <m.button
                key={msg._id}
                layout="position"
                {...listItem}
                transition={ITEM_TRANSITION}
                onClick={() => handleSelect(msg)}
                // No opacity/transform in the CSS transition: Framer moves this card, CSS only recolours it
                className={`w-full text-left p-4 rounded-chip border transition-[color,background-color,border-color,box-shadow] ${
 selected?._id === msg._id
 ? 'bg-ink/10 border-ink/40 shadow-sm'
 : 'bg-surface border-line hover:border-ink/50'
 }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className={`text-sm font-bold ${!msg.isRead ? 'text-ink dark:text-ink' : 'text-ink'}`}>
                    {!msg.isRead && <span className="w-2 h-2 bg-ink rounded-full inline-block mr-2 mb-0.5" />}
                    {msg.name}
                  </p>
                  <span className="text-muted text-xs font-medium flex-shrink-0">
                    {new Date(msg.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
                {msg.subject && <p className="text-ink text-xs font-semibold mb-1">{msg.subject}</p>}
                <p className="text-muted text-xs truncate">{msg.message}</p>
                {msg.isRead && (
                  <span className="text-ok text-[10px] font-bold flex items-center gap-1 mt-1.5">
                    <CheckCheck className="w-3 h-3" /> Read
                  </span>
                )}
              </m.button>
            ))}
            </AnimatePresence>
          </div>

          {/* Message detail */}
          <div className="relative lg:col-span-3">
            <AnimatePresence mode="popLayout" initial={false}>
            {selected ? (
              <m.div key={selected._id} {...paneSwap} className="bg-surface border border-line rounded-chip p-6 sm:p-7 h-full shadow-sm flex flex-col justify-between">
                <div>
                  <div className="border-b border-line pb-4 mb-5">
                    <h2 className="text-ink font-extrabold text-xl mb-2">{selected.subject || 'Inquiry without Subject'}</h2>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted">
                      <span className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-ink/20 rounded-full flex items-center justify-center text-ink text-xs font-bold">
                          {selected.name?.charAt(0)}
                        </div>
                        <strong className="text-ink text-sm">{selected.name}</strong>
                      </span>
                      <a href={`mailto:${mailtoAddress(selected.email)}`} className="flex items-center gap-1 text-ink dark:text-ink hover:underline [overflow-wrap:anywhere]">
                        <Mail className="w-3.5 h-3.5" /> {selected.email}
                      </a>
                      {selected.phone && (
                        <a href={telHref(selected.phone)} className="flex items-center gap-1 hover:text-ink">
                          <Phone className="w-3.5 h-3.5" /> {selected.phone}
                        </a>
                      )}
                      <span className="text-muted">
                        {new Date(selected.createdAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                  <p className="text-ink leading-relaxed whitespace-pre-wrap text-sm">{selected.message}</p>
                </div>

                <div className="mt-8 pt-4 border-t border-line">
                  <a
                    href={replyHref(selected)}
                    className="inline-flex items-center gap-2 bg-ink hover:bg-ink/85 text-ground font-bold text-sm rounded-full px-6 py-2.5 transition-colors shadow-sm"
                  >
                    <Mail className="w-4 h-4" /> Reply via Email
                  </a>
                </div>
              </m.div>
            ) : (
              <m.div key="none" {...paneSwap} className="bg-surface border border-line rounded-chip h-full flex items-center justify-center p-12 shadow-sm min-h-[300px]">
                <div className="text-center">
                  <Mail className="w-12 h-12 text-muted mx-auto mb-3" />
                  <p className="text-muted font-semibold text-sm">Select a message on the left to read full details</p>
                </div>
              </m.div>
            )}
            </AnimatePresence>
          </div>
        </m.div>
      )}
    </div>
  );
}
