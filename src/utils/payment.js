/** Readable payment method; older bookings were stored with the previous checkout's name. */
export const paymentLabel = (method) => {
  if (!method) return 'Online test';
  return method.replace(/^Razorpay\b/, 'Online test');
};
