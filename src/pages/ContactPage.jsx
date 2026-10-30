import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, Mail, Clock, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import PageWrapper from '../components/layout/PageWrapper';
import Button from '../components/ui/Button';

const inputClass = 'w-full bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none placeholder-gray-400 dark:placeholder-gray-500 shadow-xs transition-all';
const labelClass = 'block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/contact', form);
      toast.success('Message sent! We\'ll get back to you soon 📨');
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0D0D0D] text-gray-900 dark:text-white pt-20 pb-16 transition-colors">

        {/* Header */}
        <div className="text-center py-14 px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-center gap-2.5 mb-3">
              <div className="w-8 h-0.5 bg-amber-500 rounded-full" />
              <span className="text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">Get In Touch</span>
              <div className="w-8 h-0.5 bg-amber-500 rounded-full" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight mb-3">Contact Us</h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto text-base">Have a question about renting or partnership? We're available 24/7.</p>
          </motion.div>
        </div>

        <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Info Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 space-y-5"
          >
            {[
              { icon: MapPin, title: 'Headquarters', lines: ['Shop No. 12, SG Highway', 'Bodakdev, Ahmedabad', 'Gujarat — 380054'] },
              { icon: Phone, title: 'Direct Phone', lines: ['+91 79-2630-0000', '+91 98765 43210'] },
              { icon: Mail, title: 'Email Support', lines: ['info@driveaway.in', 'bookings@driveaway.in'] },
              { icon: Clock, title: 'Operating Hours', lines: ['Monday – Sunday', '7:00 AM – 10:00 PM IST'] },
            ].map(item => (
              <div key={item.title} className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-5 flex gap-4 shadow-sm">
                <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-gray-900 dark:text-white font-bold text-sm">{item.title}</p>
                  {item.lines.map(line => <p key={line} className="text-gray-600 dark:text-gray-400 text-xs mt-0.5">{line}</p>)}
                </div>
              </div>
            ))}

            {/* Map location badge */}
            <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl overflow-hidden h-36 flex items-center justify-center shadow-sm">
              <div className="text-center">
                <MapPin className="w-7 h-7 text-amber-500 mx-auto mb-1.5" />
                <p className="text-gray-900 dark:text-white text-sm font-bold">SG Highway, Bodakdev</p>
                <p className="text-gray-500 text-xs">Ahmedabad, Gujarat</p>
              </div>
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-3"
          >
            <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-gray-900 dark:text-white font-extrabold text-xl mb-6">Send Us a Direct Message</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Your Name *</label>
                    <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputClass} placeholder="Full Name" />
                  </div>
                  <div>
                    <label className={labelClass}>Email Address *</label>
                    <input type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputClass} placeholder="you@email.com" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Phone Number</label>
                    <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className={inputClass} placeholder="9999999999" />
                  </div>
                  <div>
                    <label className={labelClass}>Subject</label>
                    <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} className={inputClass} placeholder="Booking inquiry..." />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Message *</label>
                  <textarea required value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} className={`${inputClass} h-36 resize-none`} placeholder="Tell us how we can assist you..." />
                </div>
                <Button type="submit" loading={loading} icon={Send} className="w-full font-bold shadow-lg shadow-amber-500/20" size="lg">
                  Send Message
                </Button>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </PageWrapper>
  );
}
