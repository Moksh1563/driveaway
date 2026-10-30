import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Shield, Star, Car, Zap, Clock } from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';

const WHY_US = [
  { icon: Shield, title: 'Fully Insured', desc: 'Comprehensive insurance coverage on all our vehicles for complete peace of mind.' },
  { icon: Star, title: '4.9★ Rated', desc: 'Over 10,000 happy customers across Ahmedabad consistently rate us 5 stars.' },
  { icon: MapPin, title: '8 Locations', desc: 'Pickup and drop-off from SG Highway, Airport, Vastrapur, Bopal and more.' },
  { icon: Clock, title: '24/7 Support', desc: 'Our support team is available round the clock for any assistance.' },
  { icon: Zap, title: 'Instant Booking', desc: 'Book in under 2 minutes. No hidden charges. Cancel anytime.' },
  { icon: Car, title: '50+ Cars', desc: 'From budget hatchbacks to premium sports cars — we have something for everyone.' },
];

const TEAM = [
  { name: 'Arjun Mehta', role: 'Founder & CEO', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', bio: 'Ahmedabad native with 10+ years in the automotive industry.' },
  { name: 'Priya Desai', role: 'Head of Operations', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400', bio: 'Ensures every customer gets a 5-star experience.' },
  { name: 'Ravi Shah', role: 'Fleet Manager', img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400', bio: 'Keeps every car in pristine condition for your journey.' },
];

export default function AboutPage() {
  return (
    <PageWrapper>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0D0D0D] text-gray-900 dark:text-white pt-20 transition-colors">

        {/* Hero */}
        <section className="relative py-20 px-4 overflow-hidden">
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="flex items-center justify-center gap-2.5 mb-4">
                <div className="w-8 h-0.5 bg-amber-500 rounded-full" />
                <span className="text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">Our Story</span>
                <div className="w-8 h-0.5 bg-amber-500 rounded-full" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight mb-6">
                Ahmedabad's Premier<br /><span className="text-amber-500">Car Rental Experience</span>
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                Founded in Ahmedabad, Driveaway has grown from a local fleet of 5 cars to the city's most trusted car rental brand.
                We believe everyone deserves to drive in comfort and style — whether it's a corporate commute to SG Highway or
                a weekend road trip to Udaipur.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-12 px-4 bg-white dark:bg-[#111] border-y border-gray-200 dark:border-white/[0.06]">
          <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { val: '50+', label: 'Verified Cars' },
              { val: '10K+', label: 'Completed Trips' },
              { val: '8', label: 'Ahmedabad Hubs' },
              { val: '4.9★', label: 'Average Rating' },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <div className="text-3xl sm:text-4xl font-black text-amber-500 mb-1">{s.val}</div>
                <div className="text-gray-600 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-2.5 mb-2">
                <div className="w-8 h-0.5 bg-amber-500 rounded-full" />
                <span className="text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">Why Driveaway</span>
                <div className="w-8 h-0.5 bg-amber-500 rounded-full" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">Why Ahmedabad Chooses Us</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {WHY_US.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-7 shadow-sm"
                >
                  <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mb-4">
                    <item.icon className="w-6 h-6 text-amber-500" />
                  </div>
                  <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-2">{item.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="py-20 px-4 bg-gray-100 dark:bg-[#111]">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-2.5 mb-2">
                <div className="w-8 h-0.5 bg-amber-500 rounded-full" />
                <span className="text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">Leadership</span>
                <div className="w-8 h-0.5 bg-amber-500 rounded-full" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">Meet Our Team</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {TEAM.map((member, i) => (
                <motion.div
                  key={member.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl overflow-hidden text-center shadow-sm"
                >
                  <img src={member.img} alt={member.name} className="w-full h-44 object-cover object-top" />
                  <div className="p-6">
                    <h3 className="text-gray-900 dark:text-white font-bold text-base">{member.name}</h3>
                    <p className="text-amber-600 dark:text-amber-400 text-xs font-bold mb-2">{member.role}</p>
                    <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">{member.bio}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Locations */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2.5 mb-2">
              <div className="w-8 h-0.5 bg-amber-500 rounded-full" />
              <span className="text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">Pickup Spots</span>
              <div className="w-8 h-0.5 bg-amber-500 rounded-full" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-8">Serving Across Ahmedabad</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {['SG Highway', 'Vastrapur', 'Bopal', 'Ashram Road', 'Airport', 'BRTS Stand', 'Navrangpura', 'Satellite'].map(loc => (
                <div key={loc} className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-4 flex items-center gap-2.5 shadow-xs">
                  <MapPin className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="text-gray-800 dark:text-gray-200 text-sm font-semibold">{loc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
