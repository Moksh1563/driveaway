import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock, Instagram, Twitter, Facebook, ArrowRight, Check, Loader2 } from 'lucide-react';
import api from '../../api/axios';
import Logo from './Logo';
import { PAINTS, PAINT_ORDER } from '../../theme/paints';

import { HUBS } from '../../theme/hubs';

export default function Footer() {
  const year = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/discount/subscribe', { email });
      setMsg({ ok: true, text: data.message || 'You are subscribed.' });
      setEmail('');
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.message || 'Could not subscribe. Try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="bg-surface border-t border-line text-ink">
      {/* Paint strip: the whole paint book, edge to edge */}
      <div className="flex h-2" aria-hidden="true">
        {PAINT_ORDER.map((t) => <span key={t} className="flex-1" style={{ background: PAINTS[t].hex }} />)}
      </div>

      <div className="page-container pt-16 pb-10">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="display text-4xl sm:text-5xl">Offers, first.</h2>
            <p className="mt-4 max-w-md text-muted">
              Get promo codes and flash offers on hypercars and supercars by email. One click to unsubscribe.
            </p>
            {msg?.ok ? (
              <p className="mt-6 inline-flex items-center gap-2 font-semibold" role="status">
                <Check className="w-4 h-4 text-ok" /> {msg.text}
              </p>
            ) : (
              <form onSubmit={handleSubscribe} className="mt-6 flex max-w-md gap-2">
                <label htmlFor="footer-email" className="sr-only">Email address</label>
                <input
                  id="footer-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field !rounded-full"
                />
                <button type="submit" disabled={loading} className="btn-ink flex-shrink-0">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Subscribe
                </button>
              </form>
            )}
            {msg && !msg.ok && <p className="mt-2 text-sm text-danger" role="alert">{msg.text}</p>}
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm">
            <div>
              <h3 className="code-label text-[12px] text-muted mb-4">Pickup hubs</h3>
              <ul className="space-y-2">
                {HUBS.map((h) => (
                  <li key={h}>
                    <Link to={`/fleet?location=${encodeURIComponent(h)}`} className="hover:underline">{h}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-8">
              <div>
                <h3 className="code-label text-[12px] text-muted mb-4">Driveaway</h3>
                <ul className="space-y-2">
                  <li><Link to="/fleet" className="hover:underline">The fleet</Link></li>
                  <li><Link to="/about" className="hover:underline">About</Link></li>
                  <li><Link to="/contact" className="hover:underline">Contact</Link></li>
                  <li><Link to="/login" className="hover:underline">Log in</Link></li>
                  <li><Link to="/register" className="hover:underline">Create account</Link></li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 grid gap-6 border-t border-line pt-8 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p className="flex gap-2.5"><MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" /> Shop No. 12, SG Highway, Bodakdev, Ahmedabad 380054</p>
          <a href="tel:+917926300000" className="flex gap-2.5 hover:underline"><Phone className="w-4 h-4 mt-0.5" /> +91 79-2630-0000</a>
          <a href="mailto:info@driveaway.in" className="flex gap-2.5 hover:underline"><Mail className="w-4 h-4 mt-0.5" /> info@driveaway.in</a>
          <p className="flex gap-2.5"><Clock className="w-4 h-4 mt-0.5" /> Daily, 7:00 AM to 10:00 PM</p>
        </div>

        <div className="mt-12 flex flex-col-reverse gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Logo sub={null} />
            <p className="mt-3 text-xs text-muted">© {year} Driveaway Luxury Rentals, Ahmedabad, Gujarat.</p>
          </div>
          <div className="flex gap-2">
            {[
              { icon: Instagram, label: 'Instagram' },
              { icon: Twitter, label: 'Twitter' },
              { icon: Facebook, label: 'Facebook' },
            ].map(({ icon: Icon, label }) => (
              <a key={label} href="#" aria-label={label} className="w-10 h-10 grid place-items-center rounded-full border border-line hover:border-ink transition-colors">
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
