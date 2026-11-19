import React, { useCallback, useRef } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import TestCheckoutModal from '../payment/TestCheckoutModal';

/**
 * Pays an existing unpaid booking through the checkout. The server records the payment
 * (PATCH /bookings/:id/payment with the chosen method) and makes the reference; the checkout shows
 * success only once that call succeeds. onPaid(updatedBooking) runs after the success screen;
 * onClose runs when the customer leaves without paying.
 */
export default function PayBookingModal({ booking, onClose, onPaid }) {
  const { user } = useAuth();
  // Keep showing the last booking's amount while the checkout animates closed
  const last = useRef(booking);
  if (booking) last.current = booking;
  const shown = booking || last.current;
  const id = shown?._id;

  const pay = useCallback(async ({ method }) => {
    const { data } = await api.patch(`/bookings/${id}/payment`, { method });
    return data;
  }, [id]);

  return (
    <TestCheckoutModal
      isOpen={Boolean(booking)}
      onClose={onClose}
      amount={shown?.totalAmount || 0}
      customerName={shown?.customerName || user?.name || ''}
      onPaymentSuccess={pay}
      onComplete={onPaid}
    />
  );
}
