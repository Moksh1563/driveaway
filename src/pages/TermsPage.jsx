import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FlaskConical } from 'lucide-react';

const UPDATED = '19 November 2026';

/** One topic: heading on the left, plain-words body on the right (stacked on phones). */
function Section({ title, children }) {
  return (
    <section className="grid gap-4 border-t border-line py-10 lg:grid-cols-12 lg:gap-10">
      <h2 className="font-wide font-black uppercase tracking-tight text-xl lg:col-span-4">{title}</h2>
      <div className="space-y-4 leading-relaxed text-muted lg:col-span-8">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="pt-[72px]">
      <header className="page-container pt-16 pb-12 lg:pt-24">
        <p className="code-label text-[12px] text-muted">Last updated {UPDATED}</p>
        <h1 className="display mt-4 text-[clamp(2.6rem,6vw,5rem)]">Rental terms.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-snug text-muted">
          How booking a car on Driveaway works, in plain words. How your details are handled is on the{' '}
          <Link to="/privacy" className="text-ink underline">privacy page</Link>.
        </p>
        <div className="mt-10 flex max-w-3xl gap-4 rounded-chip border border-line bg-surface p-5 sm:p-6">
          <FlaskConical className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">
            <strong className="font-semibold">Driveaway is a demonstration project.</strong> It shows how online booking for a
            car rental business can work. Treat any booking you make here as a test: online payments are simulated and no money
            is charged.
          </p>
        </div>
      </header>

      <div className="page-container pb-20 lg:pb-24">
        <Section title="Who can book">
          <p>
            You need a Driveaway account and a valid driving licence. When you book, you enter the driver&apos;s details,
            including the licence number and an ID document number, and you show the licence when you collect the car.
          </p>
        </Section>

        <Section title="Dates and prices">
          <p>
            Prices are daily rates in rupees. A trip is charged for the number of days from pickup to return, with a minimum
            of one day. Dates are calendar days in India time, and a car returned on a given day can be collected by the next
            driver that same day.
          </p>
          <p>You can book up to 180 days ahead, for up to 90 days at a time.</p>
          <p>
            The total is worked out by our server when you book, including any promo code or loyalty points, and it is the
            amount on your invoice.
          </p>
        </Section>

        <Section title="Paying">
          <p>
            Pay in cash when you collect the car, or pay online with the test checkout. The test checkout is a simulation: it
            never asks for real card, UPI or bank details, and no money moves.
          </p>
          <p>
            A booking stays Pending until it is paid online or the Driveaway team confirms it. You can hold up to three unpaid
            upcoming bookings at a time.
          </p>
        </Section>

        <Section title="Promo codes and points">
          <p>
            A promo code takes a percentage off the rental, up to the limit shown for that code. A code can have an expiry
            date, a minimum booking amount or a limit on how many times it can be used.
          </p>
          <p>
            When a trip is completed you earn 1 loyalty point for every ₹100 of its total. 10 points are worth ₹1 off a later
            booking, and points can pay for up to half of a booking.
          </p>
        </Section>

        <Section title="Cancelling">
          <p>
            You can cancel a Pending or Confirmed booking from <Link to="/dashboard" className="text-ink underline">My garage</Link>{' '}
            before the pickup date. Any loyalty points you used go back to your account, and the promo code becomes usable
            again. If you paid with the test checkout, the booking is marked as refunded; as with the payment, no real money
            moves.
          </p>
          <p>
            Once the pickup date has arrived, a booking can no longer be cancelled online. If the Driveaway team cancels a
            booking, your points and promo code are returned in the same way.
          </p>
        </Section>

        <Section title="When a car is unavailable">
          <p>
            A car that is in maintenance cannot be booked until the team puts it back on the road. A car that is out on a
            booking can still be booked for other dates. For either, you can ask to be emailed when it is free again.
          </p>
        </Section>

        <Section title="Questions">
          <p>
            Anything unclear about a booking, a payment or these terms? Send us a message and the team will reply by email.
          </p>
          <p>
            <Link to="/contact" className="btn-ink">Contact Driveaway <ArrowRight className="h-4 w-4" /></Link>
          </p>
        </Section>
      </div>
    </div>
  );
}
