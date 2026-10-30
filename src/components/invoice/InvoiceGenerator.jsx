import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Convert number to words in Indian Rupees format (Lakhs, Crores)
 */
export const numberToWordsINR = (amount) => {
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
 * Extract resolved customer name and vehicle details dynamically
 */
export const extractBookingInfo = (booking, car) => {
  const customerName = (
    booking?.customerName ||
    (booking?.user && typeof booking.user === 'object' && booking.user.name) ||
    'Valued Customer'
  ).trim();

  const customerEmail = (
    booking?.customerEmail ||
    (booking?.user && typeof booking.user === 'object' && booking.user.email) ||
    'N/A'
  ).trim();

  const customerPhone = (
    booking?.customerPhone ||
    (booking?.user && typeof booking.user === 'object' && booking.user.phone) ||
    'N/A'
  ).trim();

  const carCompany = (car?.company || booking?.car?.company || '').trim();
  const carModel = (car?.name || booking?.car?.name || 'Rental Vehicle').trim();
  const fullVehicleName = carModel.toLowerCase().startsWith(carCompany.toLowerCase())
    ? carModel
    : `${carCompany} ${carModel}`.trim();

  const totalDays = Math.max(1, Number(booking?.totalDays) || 1);
  const dailyRate = Number(booking?.dailyRateSnapshot || car?.dailyRate || booking?.car?.dailyRate || 0);
  const baseRental = totalDays * (dailyRate > 0 ? dailyRate : Math.round(Number(booking?.totalAmount || 0) / totalDays));
  const discountAmount = Math.max(0, Number(booking?.discountAmount) || 0);
  const loyaltyPointsUsed = Math.max(0, Number(booking?.loyaltyPointsUsed) || 0);
  const loyaltyDiscount = loyaltyPointsUsed > 0 ? Math.round(loyaltyPointsUsed / 10) : 0;
  const totalAmount = Number(
    booking?.totalAmount !== undefined
      ? booking.totalAmount
      : Math.max(0, baseRental - discountAmount - loyaltyDiscount)
  );

  // 18% GST (Tax included in total)
  const taxableAmount = Math.round((totalAmount / 1.18) * 100) / 100;
  const gstAmount = Math.round((totalAmount - taxableAmount) * 100) / 100;
  const cgst = Math.round((gstAmount / 2) * 100) / 100;
  const sgst = Math.round((gstAmount / 2) * 100) / 100;

  return {
    customerName,
    customerEmail,
    customerPhone,
    carCompany,
    carModel,
    fullVehicleName,
    totalDays,
    dailyRate,
    baseRental,
    discountAmount,
    discountCode: booking?.discountCode || '',
    loyaltyPointsUsed,
    loyaltyDiscount,
    totalAmount,
    taxableAmount,
    gstAmount,
    cgst,
    sgst,
    invoiceNumber: booking?.invoiceNumber || 'DA-2026-000001',
    pickupDate: booking?.pickupDate,
    returnDate: booking?.returnDate,
    pickupLocation: booking?.pickupLocation || 'Main Hub, Ahmedabad',
    licenseNumber: booking?.licenseNumber || '',
    address: booking?.address || '',
    paymentMethod: booking?.paymentMethod || 'Razorpay / Online',
    paymentCompleted: Boolean(booking?.paymentCompleted),
    paymentId: booking?.paymentId || (booking?.paymentCompleted ? 'PAID-ONLINE' : 'PENDING'),
    createdAt: booking?.createdAt || Date.now(),
  };
};

/**
 * Generate PDF Tax Invoice
 */
export const generatePDF = (booking, car) => {
  const info = extractBookingInfo(booking, car);
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.width;

  // ── HEADER ──────────────────────────────────────────────
  doc.setFillColor(15, 15, 15);
  doc.rect(0, 0, pageW, 46, 'F');

  // Amber accent line
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 46, pageW, 2.5, 'F');

  // Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('DRIVE', 15, 25);
  doc.setTextColor(245, 158, 11);
  doc.text('AWAY', 15 + doc.getTextWidth('DRIVE'), 25);

  doc.setTextColor(160, 160, 160);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('PREMIUM & LUXURY CAR RENTALS — AHMEDABAD', 15, 33);
  doc.text('GSTIN: 24DRWAY1234A1Z5 | State Code: 24 (Gujarat)', 15, 39);

  // Invoice Metadata
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TAX INVOICE', pageW - 15, 19, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(245, 158, 11);
  doc.text(`#${info.invoiceNumber}`, pageW - 15, 27, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(`Date: ${new Date(info.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, pageW - 15, 34, { align: 'right' });
  doc.text(`Place of Supply: Ahmedabad (24)`, pageW - 15, 40, { align: 'right' });

  // ── COMPANY & CUSTOMER INFO ──────────────────────────────
  let y = 55;
  doc.setFillColor(24, 24, 27);
  doc.roundedRect(10, y, 92, 44, 3, 3, 'F');
  doc.roundedRect(108, y, 92, 44, 3, 3, 'F');

  // Box 1: FROM
  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('ISSUED BY', 15, y + 8);

  doc.setTextColor(240, 240, 240);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Driveaway Luxury Rentals Pvt. Ltd.', 15, y + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  const companyLines = [
    'Shop No. 12, SG Highway, Bodakdev',
    'Ahmedabad — 380054, Gujarat, India',
    'Phone: +91 79-2630-0000',
    'Email: info@driveaway.in | driveaway.in',
  ];
  companyLines.forEach((line, i) => doc.text(line, 15, y + 22 + (i * 4.8)));

  // Box 2: BILLED TO (Dynamic Customer Details)
  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('BILLED TO (CUSTOMER)', 113, y + 8);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  // Auto-truncate or fit long names nicely
  const displayName = info.customerName.length > 28 ? info.customerName.substring(0, 26) + '...' : info.customerName;
  doc.text(displayName, 113, y + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  const customerDetails = [
    info.customerPhone ? `Phone: ${info.customerPhone}` : null,
    info.customerEmail ? `Email: ${info.customerEmail}` : null,
    info.licenseNumber ? `Driver License: ${info.licenseNumber}` : null,
    info.address ? `Address: ${info.address.substring(0, 32)}` : 'Location: Ahmedabad, Gujarat',
  ].filter(Boolean);
  customerDetails.forEach((line, i) => doc.text(line, 113, y + 22 + (i * 4.8)));

  // ── VEHICLE & RESERVATION DETAILS ────────────────────────
  y = 106;
  doc.setFillColor(24, 24, 27);
  doc.roundedRect(10, y, 190, 28, 3, 3, 'F');

  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('BOOKED VEHICLE', 15, y + 7);
  doc.text('PICKUP DATE & TIME', 75, y + 7);
  doc.text('RETURN DATE', 125, y + 7);
  doc.text('DURATION', 165, y + 7);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  const displayCarName = info.fullVehicleName.length > 25 ? info.fullVehicleName.substring(0, 23) + '..' : info.fullVehicleName;
  doc.text(displayCarName, 15, y + 16);

  const pickupStr = info.pickupDate ? new Date(info.pickupDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
  const returnStr = info.returnDate ? new Date(info.returnDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
  doc.text(pickupStr, 75, y + 16);
  doc.text(returnStr, 125, y + 16);
  doc.text(`${info.totalDays} Day${info.totalDays > 1 ? 's' : ''}`, 165, y + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  doc.text(`Hub: ${info.pickupLocation}`, 15, y + 23);
  doc.text(`Rate: ₹${info.dailyRate.toLocaleString('en-IN')}/day`, 75, y + 23);

  // ── COST TABLE ────────────────────────────────────────────
  y = 140;
  const tableRows = [
    [
      '1',
      `Base Rental Fare — ${info.fullVehicleName}`,
      `${info.totalDays} Day${info.totalDays > 1 ? 's' : ''} × ₹${info.dailyRate.toLocaleString('en-IN')}`,
      `₹${info.baseRental.toLocaleString('en-IN')}`,
    ],
  ];

  if (info.discountAmount > 0) {
    tableRows.push([
      '2',
      `Promotional Discount (Promo Code: ${info.discountCode || 'SPECIAL'})`,
      'Instant Discount',
      `-₹${info.discountAmount.toLocaleString('en-IN')}`,
    ]);
  }

  if (info.loyaltyDiscount > 0) {
    tableRows.push([
      String(tableRows.length + 1),
      `Loyalty Points Redemption (${info.loyaltyPointsUsed} Points Used)`,
      'Loyalty Benefit',
      `-₹${info.loyaltyDiscount.toLocaleString('en-IN')}`,
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description of Services', 'Billing Details', 'Amount (INR)']],
    body: tableRows,
    theme: 'plain',
    headStyles: {
      fillColor: [245, 158, 11],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 4,
    },
    bodyStyles: {
      fillColor: [24, 24, 27],
      textColor: [220, 220, 220],
      fontSize: 8,
      cellPadding: 4.5,
    },
    alternateRowStyles: {
      fillColor: [18, 18, 20],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 95 },
      2: { cellWidth: 50 },
      3: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: 10, right: 10 },
  });

  // TOTAL & TAX BREAKDOWN BANNER
  const finalY = doc.lastAutoTable.finalY + 3;

  // Amber Total Bar
  doc.setFillColor(245, 158, 11);
  doc.roundedRect(10, finalY, 190, 13, 2, 2, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL INVOICE AMOUNT (PAID)', 16, finalY + 8.5);
  doc.setFontSize(13);
  doc.text(`₹${info.totalAmount.toLocaleString('en-IN')}`, pageW - 16, finalY + 8.5, { align: 'right' });

  // Amount in Words
  let detailsY = finalY + 19;
  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('AMOUNT IN WORDS:', 10, detailsY);
  doc.setTextColor(230, 230, 230);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(numberToWordsINR(info.totalAmount), 46, detailsY);

  // Tax breakdown line
  detailsY += 6;
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7.5);
  doc.text(
    `*Includes 18% GST (Taxable: ₹${info.taxableAmount.toLocaleString('en-IN')} | CGST 9%: ₹${info.cgst.toLocaleString('en-IN')} | SGST 9%: ₹${info.sgst.toLocaleString('en-IN')})`,
    10,
    detailsY
  );

  // Payment Mode and Status Card
  detailsY += 7;
  doc.setFillColor(24, 24, 27);
  doc.roundedRect(10, detailsY, 190, 16, 2, 2, 'F');

  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('PAYMENT METHOD', 15, detailsY + 5.5);
  doc.text('TRANSACTION ID / REF', 80, detailsY + 5.5);
  doc.text('PAYMENT STATUS', 150, detailsY + 5.5);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(info.paymentMethod, 15, detailsY + 11.5);
  doc.text(info.paymentId.substring(0, 26), 80, detailsY + 11.5);

  if (info.paymentCompleted) {
    doc.setTextColor(34, 197, 94); // Emerald Green
    doc.text('PAID / CONFIRMED', 150, detailsY + 11.5);
  } else {
    doc.setTextColor(245, 158, 11); // Amber
    doc.text('PAY AT PICKUP / PENDING', 150, detailsY + 11.5);
  }

  // ── FOOTER ───────────────────────────────────────────────
  const footerY = doc.internal.pageSize.height - 22;
  doc.setFillColor(245, 158, 11);
  doc.rect(0, footerY - 2, pageW, 0.5, 'F');

  doc.setTextColor(160, 160, 160);
  doc.setFontSize(7.5);
  doc.text('Thank you for driving with Driveaway! This is an official computer-generated Tax Invoice.', pageW / 2, footerY + 5, { align: 'center' });
  doc.text('Need support? Call +91 79-2630-0000 or email info@driveaway.in | Ahmedabad, Gujarat', pageW / 2, footerY + 10, { align: 'center' });
  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.text('Drive Safe • Drive Smart • DriveAway', pageW / 2, footerY + 15, { align: 'center' });

  // Save PDF
  doc.save(`Driveaway_Invoice_${info.invoiceNumber}.pdf`);
};

/**
 * Generate formatted WhatsApp invoice message
 */
export const generateWhatsAppInvoiceMessage = (booking, car) => {
  const info = extractBookingInfo(booking, car);
  const pickupDate = info.pickupDate ? new Date(info.pickupDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
  const returnDate = info.returnDate ? new Date(info.returnDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
  const paymentStatusText = info.paymentCompleted ? '✓ Paid & Confirmed' : '⏳ Pay at Pickup / Pending';

  let discountText = '';
  if (info.discountAmount > 0) {
    discountText = `\n• *Promo Discount (${info.discountCode || 'Promo'}):* -₹${info.discountAmount.toLocaleString('en-IN')}`;
  }
  if (info.loyaltyDiscount > 0) {
    discountText += `\n• *Loyalty Discount (${info.loyaltyPointsUsed} pts):* -₹${info.loyaltyDiscount.toLocaleString('en-IN')}`;
  }

  return `🚗 *DRIVEAWAY RENTALS — OFFICIAL TAX INVOICE*
━━━━━━━━━━━━━━━━━━━━
📄 *Invoice #:* ${info.invoiceNumber}
📅 *Date:* ${new Date(info.createdAt).toLocaleDateString('en-IN')}

👤 *Customer:* ${info.customerName}
📞 *Phone:* ${info.customerPhone}
🚘 *Vehicle:* ${info.fullVehicleName}
📍 *Pickup Hub:* ${info.pickupLocation}
🗓️ *Rental Duration:* ${pickupDate} ➔ ${returnDate} (${info.totalDays} Day${info.totalDays > 1 ? 's' : ''})

💰 *Fare & Charges Breakdown:*
• Base Rental Rate: ₹${info.dailyRate.toLocaleString('en-IN')}/day (${info.totalDays} days = ₹${info.baseRental.toLocaleString('en-IN')})${discountText}
• *Total Amount Paid:* ₹${info.totalAmount.toLocaleString('en-IN')}
• *In Words:* ${numberToWordsINR(info.totalAmount)}
• *Taxes:* Inclusive of 18% GST (CGST ₹${info.cgst.toLocaleString('en-IN')} + SGST ₹${info.sgst.toLocaleString('en-IN')})

💳 *Payment Information:*
• Method: ${info.paymentMethod}
• Status: ${paymentStatusText}
• Ref ID: ${info.paymentId}

━━━━━━━━━━━━━━━━━━━━
📍 *Driveaway Bodakdev, SG Highway, Ahmedabad*
📞 *Customer Support:* +91 79-2630-0000
🌐 *Website:* driveaway.in
━━━━━━━━━━━━━━━━━━━━
_Drive Safe • Drive Smart • DriveAway_ ✨`;
};

/**
 * Trigger WhatsApp invoice send
 */
export const sendWhatsAppInvoice = (booking, car, customPhone) => {
  if (!booking) return;

  const rawPhone = customPhone || booking.customerPhone || booking.user?.phone || '';
  let cleanPhone = rawPhone.toString().replace(/[^0-9]/g, '');

  // Prepend 91 for 10-digit Indian numbers
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }

  const message = generateWhatsAppInvoiceMessage(booking, car);
  const encodedMessage = encodeURIComponent(message);

  const url = cleanPhone && cleanPhone.length >= 10
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`
    : `https://api.whatsapp.com/send?text=${encodedMessage}`;

  window.open(url, '_blank');
};
