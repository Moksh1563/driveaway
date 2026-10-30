require('dotenv').config();

/**
 * Format phone number to international standard without '+'
 * Default to India (+91) if 10 digits
 */
const formatWhatsAppPhone = (phone) => {
  if (!phone) return '';
  let cleaned = phone.toString().replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
};

const numberToWordsINR = (amount) => {
  if (!amount || isNaN(amount)) return 'Zero Rupees Only';
  const num = Math.round(Number(amount));
  if (num === 0) return 'Zero Rupees Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
  };

  return inWords(num).trim() + ' Rupees Only';
};

/**
 * Generate formatted WhatsApp invoice message
 */
const generateWhatsAppInvoiceText = (booking, car) => {
  const carCompany = (car?.company || booking?.car?.company || '').trim();
  const carModel = (car?.name || booking?.car?.name || 'Rental Vehicle').trim();
  const vehicleFull = carModel.toLowerCase().startsWith(carCompany.toLowerCase())
    ? carModel
    : `${carCompany} ${carModel}`.trim();

  const customerName = (
    booking.customerName ||
    (booking.user && typeof booking.user === 'object' && booking.user.name) ||
    'Valued Customer'
  ).trim();

  const customerPhone = (
    booking.customerPhone ||
    (booking.user && typeof booking.user === 'object' && booking.user.phone) ||
    'N/A'
  ).trim();

  const invoiceNum = booking.invoiceNumber || 'N/A';
  const pickupDate = booking.pickupDate ? new Date(booking.pickupDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
  const returnDate = booking.returnDate ? new Date(booking.returnDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
  const days = Math.max(1, Number(booking.totalDays) || 1);
  const total = Number(booking.totalAmount || 0);
  const baseRate = Number(booking.dailyRateSnapshot || car?.dailyRate || booking.car?.dailyRate || 0);
  const baseRental = days * (baseRate > 0 ? baseRate : Math.round(total / days));
  const paymentStatus = booking.paymentCompleted ? '✓ Paid & Confirmed' : '⏳ Pay at Pickup / Pending';

  let discountText = '';
  if (booking.discountAmount > 0) {
    discountText = `\n• *Promo Discount (${booking.discountCode || 'Code'}):* -₹${Number(booking.discountAmount).toLocaleString('en-IN')}`;
  }
  if (booking.loyaltyPointsUsed > 0) {
    discountText += `\n• *Loyalty Discount (${booking.loyaltyPointsUsed} pts):* -₹${Math.round(booking.loyaltyPointsUsed / 10).toLocaleString('en-IN')}`;
  }

  return `🚗 *DRIVEAWAY RENTALS — OFFICIAL TAX INVOICE*
━━━━━━━━━━━━━━━━━━━━
📄 *Invoice #:* ${invoiceNum}
📅 *Date:* ${new Date(booking.createdAt || Date.now()).toLocaleDateString('en-IN')}

👤 *Customer:* ${customerName}
📞 *Phone:* ${customerPhone}
🚘 *Vehicle:* ${vehicleFull}
📍 *Pickup Location:* ${booking.pickupLocation || 'Main Hub, Ahmedabad'}
🗓️ *Rental Duration:* ${pickupDate} ➔ ${returnDate} (${days} Day${days > 1 ? 's' : ''})

💰 *Fare Breakdown:*
• Base Rental Rate: ₹${baseRate.toLocaleString('en-IN')}/day (${days} Days = ₹${baseRental.toLocaleString('en-IN')})${discountText}
• *Total Amount Paid:* ₹${total.toLocaleString('en-IN')}
• *In Words:* ${numberToWordsINR(total)}
• *Taxes:* Inclusive of 18% GST (CGST + SGST)

💳 *Payment Information:*
• *Payment Mode:* ${booking.paymentMethod || 'Online'}
• *Status:* ${paymentStatus}
• *Ref ID:* ${booking.paymentId || (booking.paymentCompleted ? 'PAID-ONLINE' : 'PENDING')}

━━━━━━━━━━━━━━━━━━━━
📍 *Driveaway Bodakdev, SG Highway, Ahmedabad*
📞 *Customer Support:* +91 79-2630-0000
🌐 *Website:* driveaway.in
━━━━━━━━━━━━━━━━━━━━
_Drive Safe • Drive Smart • DriveAway_ ✨`;
};

/**
 * Generate click-to-chat WhatsApp URL
 */
const getWhatsAppUrl = (phone, text) => {
  const cleanPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(text);
  if (cleanPhone && cleanPhone.length >= 10) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
};

/**
 * Optional backend automatic dispatch via Twilio WhatsApp API
 * (Active if TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER are in .env)
 */
const sendWhatsAppMessageViaTwilio = async ({ to, text }) => {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
    return {
      success: false,
      message: 'Twilio WhatsApp credentials not configured. Use WhatsApp direct link.',
    };
  }

  try {
    const twilio = require('twilio');
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const cleanPhone = formatWhatsAppPhone(to);

    const message = await client.messages.create({
      from: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:+${cleanPhone}`,
      body: text,
    });

    return { success: true, messageId: message.sid };
  } catch (error) {
    console.error('❌ Twilio WhatsApp send error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  formatWhatsAppPhone,
  generateWhatsAppInvoiceText,
  getWhatsAppUrl,
  sendWhatsAppMessageViaTwilio,
};
