import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Download, LayoutDashboard, Calendar, MapPin, Car, MessageCircle } from 'lucide-react';
import api from '../api/axios';
import { generatePDF, sendWhatsAppInvoice } from '../components/invoice/InvoiceGenerator';
import PageWrapper from '../components/layout/PageWrapper';
import Spinner from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

export default function BookingSuccessPage() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get(`/bookings/${id}`);
        setBooking(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0D0D0D] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <PageWrapper>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0D0D0D] flex items-center justify-center py-20 px-4 transition-colors">
        <div className="max-w-lg w-full">
          {/* Animated check */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
            className="w-20 h-20 bg-green-500/10 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm"
          >
            <CheckCircle className="w-10 h-10 text-green-500" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <h1 className="text-gray-900 dark:text-white text-3xl font-extrabold mb-2">Booking Confirmed! 🎉</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Your car is reserved. Get ready to Driveaway across Ahmedabad!</p>
          </motion.div>

          {booking && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-6 sm:p-7 space-y-4 mb-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold tracking-wider">Invoice No.</span>
                <span className="text-amber-500 font-mono font-extrabold text-sm">{booking.invoiceNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5"><Car className="w-4 h-4 text-amber-500" />Vehicle</span>
                <span className="text-gray-900 dark:text-white font-bold">{booking.car?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5"><MapPin className="w-4 h-4 text-amber-500" />Pickup Hub</span>
                <span className="text-gray-900 dark:text-white font-bold">{booking.pickupLocation}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5"><Calendar className="w-4 h-4 text-amber-500" />Trip Dates</span>
                <span className="text-gray-900 dark:text-white font-bold text-xs">
                  {new Date(booking.pickupDate).toLocaleDateString('en-IN')} → {new Date(booking.returnDate).toLocaleDateString('en-IN')}
                </span>
              </div>
              <div className="border-t border-gray-100 dark:border-white/10 pt-3 flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300 font-bold text-sm">Total Amount</span>
                <span className="text-amber-500 font-black text-2xl">₹{booking.totalAmount?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold tracking-wider">Status</span>
                <Badge status={booking.status} />
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="secondary"
                onClick={() => booking && generatePDF(booking, booking.car)}
                icon={Download}
                className="w-full font-bold"
                size="lg"
              >
                Download PDF
              </Button>
              <button
                type="button"
                onClick={() => booking && sendWhatsAppInvoice(booking, booking.car)}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <MessageCircle className="w-5 h-5 text-white" />
                WhatsApp Invoice
              </button>
            </div>
            <Link
              to="/dashboard"
              className="w-full py-3.5 px-6 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-black font-extrabold text-base flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-amber-500/25"
            >
              <LayoutDashboard className="w-5 h-5" />
              My Dashboard
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-gray-500 dark:text-gray-400 text-xs mt-4 font-medium"
          >
            You've earned <strong>{Math.floor((booking?.totalAmount || 0) / 100)} loyalty points</strong> for this booking! 🏅
          </motion.p>
        </div>
      </div>
    </PageWrapper>
  );
}
