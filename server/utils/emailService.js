require('dotenv').config();
const nodemailer = require('nodemailer');

const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ EMAIL_USER or EMAIL_PASS not set in .env. Emails will not be sent.');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * Format date helper
 */
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (e) {
    return dateStr;
  }
};

/**
 * Send Booking Confirmation Email
 */
const sendBookingConfirmationEmail = async ({ booking, car, user }) => {
  try {
    const transporter = createTransporter();
    if (!transporter) return;

    const recipient = booking.customerEmail || (user && user.email);
    if (!recipient) {
      console.warn('⚠️ No recipient email found for booking confirmation.');
      return;
    }

    const carCompany = (car?.company || (booking.car && booking.car.company) || '').trim();
    const carModel = (car?.name || (booking.car && booking.car.name) || 'Rental Car').trim();
    const carName = carModel.toLowerCase().startsWith(carCompany.toLowerCase())
      ? carModel
      : `${carCompany} ${carModel}`.trim();

    const pickupDateStr = formatDate(booking.pickupDate);
    const returnDateStr = formatDate(booking.returnDate);
    const totalDays = Math.max(1, Number(booking.totalDays) || 1);
    const dailyRate = Number(booking.dailyRateSnapshot || (car && car.dailyRate) || (booking.car && booking.car.dailyRate) || 0);
    const baseRental = totalDays * (dailyRate > 0 ? dailyRate : Math.round(Number(booking.totalAmount || 0) / totalDays));
    const totalAmount = Number(booking.totalAmount || 0);

    const taxable = Math.round((totalAmount / 1.18) * 100) / 100;
    const gst = Math.round((totalAmount - taxable) * 100) / 100;

    const mailOptions = {
      from: `"Driveaway Rentals" <${process.env.EMAIL_USER}>`,
      to: recipient,
      subject: `🚗 Booking Confirmed! Invoice #${booking.invoiceNumber} - Driveaway`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
            .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #ffffff; padding: 30px 24px; text-align: center; }
            .logo { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #38bdf8; margin: 0; }
            .subtitle { font-size: 14px; color: #94a3b8; margin-top: 6px; }
            .status-badge { display: inline-block; background-color: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 12px; }
            .content { padding: 24px; }
            .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
            .section-title { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
            .row-label { color: #64748b; }
            .row-value { font-weight: 600; color: #0f172a; text-align: right; }
            .highlight { color: #0284c7; }
            .divider { border-top: 1px dashed #cbd5e1; margin: 12px 0; }
            .total-row { display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; color: #0f172a; padding-top: 4px; }
            .footer { background: #f1f5f9; padding: 18px; text-align: center; font-size: 12px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="logo">🚗 DRIVEAWAY</h1>
              <p class="subtitle">Ahmedabad's Premier Car Rental Experience</p>
              <div class="status-badge">Booking Confirmed</div>
            </div>

            <div class="content">
              <p style="font-size: 16px; margin-top: 0;">Hi <strong>${booking.customerName || (user && user.name) || 'Valued Customer'}</strong>,</p>
              <p style="color: #475569; font-size: 14px; line-height: 1.5;">
                Thank you for choosing Driveaway! Your booking has been confirmed. Below are your reservation and invoice details:
              </p>

              <!-- Booking Details -->
              <div class="card">
                <div class="section-title">Reservation Details</div>
                <div class="row">
                  <span class="row-label">Invoice Number:</span>
                  <span class="row-value highlight">#${booking.invoiceNumber || 'N/A'}</span>
                </div>
                <div class="row">
                  <span class="row-label">Vehicle:</span>
                  <span class="row-value">${carName}</span>
                </div>
                <div class="row">
                  <span class="row-label">Pickup Location:</span>
                  <span class="row-value">${booking.pickupLocation || 'Main Hub'}</span>
                </div>
                <div class="row">
                  <span class="row-label">Pickup Date:</span>
                  <span class="row-value">${pickupDateStr}</span>
                </div>
                <div class="row">
                  <span class="row-label">Return Date:</span>
                  <span class="row-value">${returnDateStr}</span>
                </div>
                <div class="row">
                  <span class="row-label">Total Duration:</span>
                  <span class="row-value">${totalDays} Day(s)</span>
                </div>
              </div>

              <!-- Payment Summary -->
              <div class="card">
                <div class="section-title">Payment Summary</div>
                <div class="row">
                  <span class="row-label">Daily Rental Rate:</span>
                  <span class="row-value">₹${dailyRate.toLocaleString('en-IN')}/day</span>
                </div>
                <div class="row">
                  <span class="row-label">Base Rental (${totalDays} Days):</span>
                  <span class="row-value">₹${baseRental.toLocaleString('en-IN')}</span>
                </div>
                <div class="row">
                  <span class="row-label">Payment Method:</span>
                  <span class="row-value">${booking.paymentMethod || 'Online'}</span>
                </div>
                ${
                  booking.discountAmount > 0
                    ? `
                <div class="row" style="color: #16a34a;">
                  <span>Promo Discount (${booking.discountCode || 'Promo'}):</span>
                  <span>-₹${Number(booking.discountAmount).toLocaleString('en-IN')}</span>
                </div>`
                    : ''
                }
                ${
                  booking.loyaltyPointsUsed > 0
                    ? `
                <div class="row" style="color: #16a34a;">
                  <span>Loyalty Discount (${booking.loyaltyPointsUsed} pts):</span>
                  <span>-₹${Math.round(booking.loyaltyPointsUsed / 10).toLocaleString('en-IN')}</span>
                </div>`
                    : ''
                }
                <div class="row" style="font-size: 12px; color: #64748b; margin-top: 4px;">
                  <span>Taxes (18% GST Included):</span>
                  <span>₹${gst.toLocaleString('en-IN')}</span>
                </div>
                <div class="divider"></div>
                <div class="total-row">
                  <span>Total Amount Paid:</span>
                  <span style="color: #0284c7;">₹${totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <p style="font-size: 13px; color: #64748b; line-height: 1.5;">

                <strong>Important Notice:</strong> Please present a valid Driver's License and original Government ID at the time of pickup.
              </p>
            </div>

            <div class="footer">
              <p style="margin: 0 0 6px 0;">Need help or want to make changes? Contact us at support@driveaway.com</p>
              <p style="margin: 0;">Driveaway Car Rentals • Ahmedabad, Gujarat</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Booking confirmation email sent to ${recipient} (Message ID: ${info.messageId})`);
  } catch (error) {
    console.error('❌ Error sending booking confirmation email:', error.message);
  }
};

/**
 * Send Contact Message Confirmation (User + Admin notification)
 */
const sendContactMessageEmail = async ({ name, email, phone, subject, message }) => {
  try {
    const transporter = createTransporter();
    if (!transporter) return;

    // 1. Send Auto-Reply to the user
    await transporter.sendMail({
      from: `"Driveaway Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `We've received your message - Driveaway`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0284c7; margin-top: 0;">Thanks for reaching out, ${name}! 🚗</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            We have received your message regarding <strong>${subject || 'General Inquiry'}</strong>. Our customer support team in Ahmedabad will get back to you shortly.
          </p>
          <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #475569;">
            <em>"${message}"</em>
          </div>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">
            Best regards,<br>
            Driveaway Support Team
          </p>
        </div>
      `,
    });

    // 2. Alert Admin (send copy to EMAIL_USER)
    await transporter.sendMail({
      from: `"Driveaway Contact Bot" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `📩 New Contact Form Inquiry from ${name} (${subject || 'General'})`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h3 style="color: #0f172a; margin-top: 0;">New Contact Form Message</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          <p><strong>Subject:</strong> ${subject || 'N/A'}</p>
          <p><strong>Message:</strong></p>
          <div style="background-color: #f1f5f9; padding: 12px; border-radius: 6px;">
            ${message}
          </div>
        </div>
      `,
    });

    console.log(`✉️ Contact auto-reply sent to ${email} and admin notification dispatched.`);
  } catch (error) {
    console.error('❌ Error sending contact message emails:', error.message);
  }
};

/**
 * Send Booking Status Update Email (Admin updates status: Confirmed, Completed, Cancelled)
 */
const sendBookingStatusUpdateEmail = async ({ booking, newStatus }) => {
  try {
    const transporter = createTransporter();
    if (!transporter) return;

    const recipient = booking.customerEmail || (booking.user && booking.user.email);
    if (!recipient) return;

    const carName = booking.car ? `${booking.car.company || ''} ${booking.car.name || 'Rental Car'}`.trim() : 'Rental Car';

    await transporter.sendMail({
      from: `"Driveaway Rentals" <${process.env.EMAIL_USER}>`,
      to: recipient,
      subject: `🚗 Update on Booking #${booking.invoiceNumber}: Status is ${newStatus}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; margin-top: 0;">Booking Status Updated 🚗</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Hello <strong>${booking.customerName || 'Customer'}</strong>,
          </p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            The status of your booking for <strong>${carName}</strong> (Invoice #${booking.invoiceNumber}) has been updated to:
          </p>
          <div style="display: inline-block; background-color: #0284c7; color: white; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; margin: 10px 0;">
            ${newStatus}
          </div>
          <p style="font-size: 13px; color: #64748b; margin-top: 16px;">
            If you have any questions about this change, feel free to reply to this email or reach us at support@driveaway.com.
          </p>
        </div>
      `,
    });

    console.log(`✉️ Booking status update email sent to ${recipient} (Status: ${newStatus})`);
  } catch (error) {
    console.error('❌ Error sending status update email:', error.message);
  }
};

/**
 * Send Car Availability Notification Email
 */
const sendCarAvailabilityEmail = async ({ recipientEmail, car }) => {
  try {
    const transporter = createTransporter();
    if (!transporter) return;
    if (!recipientEmail || !car) return;

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const carName = `${car.company || ''} ${car.name || 'Vehicle'}`.trim();
    const carImage = car.images?.main || (car.images && car.images[0]) || '';
    const carUrl = `${clientUrl}/fleet/${car._id}`;

    const mailOptions = {
      from: `"Driveaway Fleet Alerts" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: `🔔 Good News! ${carName} is Back & Available for Booking!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
            .header { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; padding: 32px 24px; text-align: center; }
            .logo { font-size: 26px; font-weight: 800; color: #ffffff; margin: 0; }
            .badge { display: inline-block; background-color: #10b981; color: white; padding: 5px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; margin-top: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
            .content { padding: 28px 24px; text-align: center; }
            .car-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: left; }
            .car-img { width: 100%; max-height: 240px; object-fit: cover; border-radius: 8px; margin-bottom: 16px; background-color: #e2e8f0; }
            .car-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0; }
            .car-price { font-size: 18px; font-weight: 800; color: #0284c7; margin-bottom: 12px; }
            .specs-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; text-align: center; font-size: 13px; color: #64748b; }
            .spec-box { background: #ffffff; border: 1px solid #e2e8f0; padding: 8px; border-radius: 6px; }
            .btn { display: inline-block; background: #0284c7; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 16px; margin-top: 10px; }
            .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="logo">🚗 DRIVEAWAY</h1>
              <p style="margin: 6px 0 0 0; color: #e0f2fe; font-size: 14px;">Vehicle Availability Notification</p>
              <div class="badge">Now Available</div>
            </div>

            <div class="content">
              <h2 style="font-size: 22px; color: #0f172a; margin-top: 0;">You asked to be notified!</h2>
              <p style="color: #475569; font-size: 15px; line-height: 1.5; margin-bottom: 20px;">
                Great news! <strong>${carName}</strong> is back from its rental or maintenance schedule and is now ready for booking.
              </p>

              <div class="car-card">
                ${carImage ? `<img src="${carImage}" alt="${carName}" class="car-img" />` : ''}
                <div class="car-title">${carName}</div>
                <div class="car-price">₹${car.dailyRate}/day</div>
                <div class="specs-grid">
                  <div class="spec-box"><strong>Seats:</strong> ${car.seats || 5}</div>
                  <div class="spec-box"><strong>Fuel:</strong> ${car.fuelType || 'Petrol'}</div>
                  <div class="spec-box"><strong>Trans:</strong> ${car.transmission || 'Automatic'}</div>
                </div>
              </div>

              <a href="${carUrl}" class="btn">Book ${carName} Now →</a>

              <p style="font-size: 13px; color: #94a3b8; margin-top: 24px; line-height: 1.4;">
                Hurry, popular vehicles get booked fast! This was a one-time alert because you signed up for notifications on this vehicle.
              </p>
            </div>

            <div class="footer">
              <p style="margin: 0 0 6px 0;">Driveaway Car Rentals • Ahmedabad, Gujarat</p>
              <p style="margin: 0;">You received this because you requested availability updates for this car.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Car availability email sent to ${recipientEmail} for car "${carName}" (Message ID: ${info.messageId})`);
  } catch (error) {
    console.error(`❌ Error sending car availability email to ${recipientEmail}:`, error.message);
  }
};

/**
 * Send Discount Announcement / Broadcast Email
 */
const sendDiscountBroadcastEmail = async ({ recipientEmail, recipientName, discountCode, percentageOff, maxDiscount, description }) => {
  try {
    const transporter = createTransporter();
    if (!transporter) return;
    if (!recipientEmail || !discountCode) return;

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const fleetUrl = `${clientUrl}/fleet`;

    const mailOptions = {
      from: `"Driveaway Special Deals" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: `🎉 Special Offer: ${percentageOff}% OFF with code ${discountCode}! - Driveaway`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
            .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; padding: 36px 24px; text-align: center; }
            .logo { font-size: 26px; font-weight: 800; color: #ffffff; margin: 0; }
            .offer-badge { display: inline-block; background-color: #f59e0b; color: #ffffff; padding: 6px 18px; border-radius: 20px; font-size: 13px; font-weight: 800; margin-top: 14px; text-transform: uppercase; letter-spacing: 1px; }
            .content { padding: 32px 24px; text-align: center; }
            .headline { font-size: 26px; font-weight: 800; color: #0f172a; margin-top: 0; }
            .desc { color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
            .coupon-box { background: #eef2ff; border: 2px dashed #6366f1; border-radius: 12px; padding: 20px; margin: 20px auto; max-width: 400px; }
            .coupon-code { font-size: 28px; font-weight: 900; color: #4338ca; letter-spacing: 2px; }
            .coupon-sub { font-size: 14px; font-weight: 600; color: #4f46e5; margin-top: 6px; }
            .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 14px 34px; border-radius: 8px; font-weight: 700; font-size: 16px; margin-top: 16px; }
            .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="logo">🚗 DRIVEAWAY</h1>
              <p style="margin: 6px 0 0 0; color: #e0e7ff; font-size: 14px;">Exclusive Discount Announcement</p>
              <div class="offer-badge">Limited Time Offer</div>
            </div>

            <div class="content">
              <h2 class="headline">Unlock ${percentageOff}% OFF Your Next Drive! 🚀</h2>
              <p class="desc">
                ${recipientName ? `Hi <strong>${recipientName}</strong>, ` : ''}
                Whether you're planning a weekend getaway or driving your dream supercar, here is a special gift from Driveaway to make your journey extraordinary.
              </p>

              <div class="coupon-box">
                <div style="font-size: 12px; color: #6366f1; font-weight: 700; text-transform: uppercase;">Use Promo Code</div>
                <div class="coupon-code">${discountCode}</div>
                <div class="coupon-sub">
                  Get ${percentageOff}% Instant Discount ${maxDiscount ? `(Up to ₹${maxDiscount})` : ''}
                </div>
              </div>

              ${description ? `<p style="font-size: 14px; color: #64748b; font-style: italic;">"${description}"</p>` : ''}

              <a href="${fleetUrl}" class="btn">Explore Fleet & Apply Code →</a>

              <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">
                Apply code <strong>${discountCode}</strong> at checkout. Offer valid for a limited period across eligible fleet vehicles in Ahmedabad.
              </p>
            </div>

            <div class="footer">
              <p style="margin: 0 0 6px 0;">Driveaway Car Rentals • Ahmedabad, Gujarat</p>
              <p style="margin: 0;">You received this email because you are a registered user or subscriber of Driveaway.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Discount broadcast email sent to ${recipientEmail} with code ${discountCode} (Message ID: ${info.messageId})`);
  } catch (error) {
    console.error(`❌ Error sending discount broadcast email to ${recipientEmail}:`, error.message);
  }
};

module.exports = {
  createTransporter,
  sendBookingConfirmationEmail,
  sendContactMessageEmail,
  sendBookingStatusUpdateEmail,
  sendCarAvailabilityEmail,
  sendDiscountBroadcastEmail,
};

