/**
 * ============================================================================
 * MAIN APPLICATION FOOTER
 * ============================================================================
 * Provides brand summary, quick links, Ahmedabad hub addresses, contact info,
 * and an inline email subscription bar for discount promo notifications.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, MapPin, Phone, Mail, Clock, Instagram, Twitter, Facebook, Tag, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import api from '../../api/axios';

export default function Footer() {

  const year = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setLoading(true);
    try {
      const { data } = await api.post('/discount/subscribe', { email });
      setMsg(data.message || 'Subscribed successfully!');
      setEmail('');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to subscribe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="bg-white dark:bg-[#0A0A0A] border-t border-gray-200 dark:border-white/[0.06] text-gray-600 dark:text-gray-400 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* Discount Notification Strip */}
        <div className="mb-12 p-6 sm:p-8 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Special Offer Notifications
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Get Discount Codes & Flash Deals Sent to Your Inbox
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Sign up for our discount alerts and get up to 25% OFF on luxury and sports rentals.
            </p>
          </div>

          <div className="w-full md:w-auto flex-shrink-0">
            {msg ? (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-xl">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{msg}</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2 max-w-sm w-full">
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 w-full"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
                  Subscribe
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shadow-sm">
                <Car className="w-5 h-5 text-black" />
              </div>
              <span className="text-gray-900 dark:text-white font-bold text-xl tracking-tight">
                Drive<span className="text-amber-500">away</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed">
              Ahmedabad's premier car rental platform. Rent sports, luxury, electric, and family cars with transparent pricing.
            </p>
            <div className="flex items-center gap-3">
              <a href="#" className="w-8 h-8 bg-gray-100 dark:bg-white/5 hover:bg-amber-500/20 border border-gray-200 dark:border-white/10 rounded-lg flex items-center justify-center transition-colors hover:border-amber-500/30">
                <Instagram className="w-4 h-4 text-gray-600 dark:text-gray-400 hover:text-amber-500" />
              </a>
              <a href="#" className="w-8 h-8 bg-gray-100 dark:bg-white/5 hover:bg-amber-500/20 border border-gray-200 dark:border-white/10 rounded-lg flex items-center justify-center transition-colors hover:border-amber-500/30">
                <Twitter className="w-4 h-4 text-gray-600 dark:text-gray-400 hover:text-amber-500" />
              </a>
              <a href="#" className="w-8 h-8 bg-gray-100 dark:bg-white/5 hover:bg-amber-500/20 border border-gray-200 dark:border-white/10 rounded-lg flex items-center justify-center transition-colors hover:border-amber-500/30">
                <Facebook className="w-4 h-4 text-gray-600 dark:text-gray-400 hover:text-amber-500" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-gray-900 dark:text-white font-bold text-xs uppercase tracking-wider">Quick Links</h3>
            <ul className="space-y-2.5">
              {[
                { to: '/fleet', label: 'Explore Fleet' },
                { to: '/about', label: 'About Us' },
                { to: '/contact', label: 'Contact Support' },
                { to: '/login', label: 'Customer Login' },
                { to: '/register', label: 'Create Account' },
              ].map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm font-medium hover:text-amber-500 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Pickup Locations */}
          <div className="space-y-4">
            <h3 className="text-gray-900 dark:text-white font-bold text-xs uppercase tracking-wider">Ahmedabad Hubs</h3>
            <ul className="space-y-2">
              {['SG Highway', 'Vastrapur', 'Bopal', 'Ashram Road', 'Ahmedabad Airport', 'BRTS Bus Stand', 'Navrangpura', 'Satellite'].map((loc) => (
                <li key={loc} className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  {loc}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-gray-900 dark:text-white font-bold text-xs uppercase tracking-wider">Contact Us</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span>Shop No. 12, SG Highway,<br />Bodakdev, Ahmedabad – 380054</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <a href="tel:+917926300000" className="hover:text-amber-500 transition-colors">+91 79-2630-0000</a>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <a href="mailto:info@driveaway.in" className="hover:text-amber-500 transition-colors">info@driveaway.in</a>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>Daily: 7:00 AM – 10:00 PM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-gray-200 dark:border-white/[0.06] mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
          <p>© {year} Driveaway Luxury Rentals. All rights reserved.</p>
          <p>Made with ❤️ for Ahmedabad • Gujarat, India</p>
        </div>
      </div>
    </footer>
  );
}
