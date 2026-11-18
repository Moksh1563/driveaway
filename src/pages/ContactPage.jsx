import React, { useState } from 'react';
import { MapPin, Phone, Mail, Clock, ArrowRight, Check } from 'lucide-react';
import api from '../api/axios';
import Button from '../components/ui/Button';
import { paintStyle } from '../theme/paints';

const DETAILS = [
  { icon: MapPin, title: 'Headquarters', lines: ['Shop No. 12, SG Highway', 'Bodakdev, Ahmedabad, Gujarat 380054'] },
  { icon: Phone, title: 'Phone', lines: ['+91 79-2630-0000', '+91 98765 43210'], href: 'tel:+917926300000' },
  { icon: Mail, title: 'Email', lines: ['info@driveaway.in', 'bookings@driveaway.in'], href: 'mailto:info@driveaway.in' },
  { icon: Clock, title: 'Hours', lines: ['Every day', '7:00 AM to 10:00 PM IST'] },
];

const EMPTY = { name: '', email: '', phone: '', subject: '', message: '' };

export default function ContactPage() {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { ok, text }

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      await api.post('/contact', form);
      setStatus({ ok: true, text: 'Message sent. We usually reply within a few hours.' });
      setForm(EMPTY);
    } catch (err) {
      setStatus({ ok: false, text: err.response?.data?.message || 'Could not send your message. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-[72px]">
      <section style={paintStyle('Luxury')} className="lacquer on-paint">
        <div className="page-container grid gap-10 py-16 lg:grid-cols-12 lg:py-24">
          <div className="lg:col-span-6">
            <h1 className="display text-[clamp(2.8rem,6.5vw,6rem)]">Talk to us.</h1>
            <p className="mt-6 max-w-md text-lg leading-snug">
              Questions about a car, a booking, a wedding convoy or a partnership. A person in Ahmedabad will reply.
            </p>
          </div>
          <dl className="grid gap-6 sm:grid-cols-2 lg:col-span-6 lg:pt-3">
            {DETAILS.map(({ icon: Icon, title, lines, href }) => (
              <div key={title} className="border-t border-on-paint/30 pt-4">
                <dt className="flex items-center gap-2 code-label text-[12px]"><Icon className="h-4 w-4" /> {title}</dt>
                <dd className="mt-2 font-semibold leading-snug">
                  {href ? <a href={href} className="hover:underline">{lines[0]}</a> : lines[0]}
                  <span className="block font-normal">{lines[1]}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="page-container py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="font-wide font-black uppercase tracking-tight text-2xl">Send a message</h2>
            <p className="mt-3 text-muted">Fields marked * are required. We never share your details.</p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
            <label className="block">
              <span className="field-label">Your name *</span>
              <input required value={form.name} onChange={set('name')} autoComplete="name" className="field" />
            </label>
            <label className="block">
              <span className="field-label">Email *</span>
              <input type="email" required value={form.email} onChange={set('email')} autoComplete="email" className="field" />
            </label>
            <label className="block">
              <span className="field-label">Phone</span>
              <input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" className="field" />
            </label>
            <label className="block">
              <span className="field-label">Subject</span>
              <input value={form.subject} onChange={set('subject')} placeholder="Booking question" className="field" />
            </label>
            <label className="block sm:col-span-2">
              <span className="field-label">Message *</span>
              <textarea required value={form.message} onChange={set('message')} rows={6} maxLength={3000} className="field resize-y" />
            </label>

            {status && (
              <p role={status.ok ? 'status' : 'alert'} className={`sm:col-span-2 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${status.ok ? 'bg-ok/10 text-ok' : 'bg-danger/10 text-danger'}`}>
                {status.ok && <Check className="h-4 w-4" />} {status.text}
              </p>
            )}

            <div className="sm:col-span-2">
              <Button type="submit" loading={loading} className="!px-8 !py-4 text-base">
                Send message <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
