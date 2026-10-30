import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Car } from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';

export default function NotFoundPage() {
  return (
    <PageWrapper>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0D0D0D] text-gray-900 dark:text-white flex items-center justify-center px-4 transition-colors">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-amber-300 mb-4"
          >
            404
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-gray-900 dark:text-white text-3xl font-extrabold mb-3">Road Not Found</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-sm mx-auto text-sm">
              Looks like you've taken an unexpected detour. Let's get you back on track.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link to="/" className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full px-6 py-3 transition-colors shadow-sm">
                <Home className="w-4 h-4" /> Go to Home
              </Link>
              <Link to="/fleet" className="flex items-center gap-2 border border-gray-300 dark:border-white/20 hover:border-amber-500 text-gray-800 dark:text-white font-bold rounded-full px-6 py-3 transition-colors bg-white dark:bg-white/5">
                <Car className="w-4 h-4" /> Browse Fleet
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </PageWrapper>
  );
}
