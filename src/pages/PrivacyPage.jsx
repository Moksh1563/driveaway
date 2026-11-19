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

/** A short labelled list: the label in ink, the detail in muted text. */
function Facts({ items }) {
  return (
    <dl className="space-y-3">
      {items.map(([label, detail]) => (
        <div key={label}>
          <dt className="font-semibold text-ink">{label}</dt>
          <dd className="mt-0.5">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function PrivacyPage() {
  return (
    <div className="pt-[72px]">
      <header className="page-container pt-16 pb-12 lg:pt-24">
        <p className="code-label text-[12px] text-muted">Last updated {UPDATED}</p>
        <h1 className="display mt-4 text-[clamp(2.6rem,6vw,5rem)]">Privacy.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-snug text-muted">
          What Driveaway stores about you, why, who can see it, and what you can do about it. How bookings work is in the{' '}
          <Link to="/terms" className="text-ink underline">rental terms</Link>.
        </p>
        <div className="mt-10 flex max-w-3xl gap-4 rounded-chip border border-line bg-surface p-5 sm:p-6">
          <FlaskConical className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">
            <strong className="font-semibold">Driveaway is a demonstration project.</strong> Payments are simulated and no money
            is charged. If you are only trying the site out, consider entering test details instead of your real licence and
            ID numbers.
          </p>
        </div>
      </header>

      <div className="page-container pb-20 lg:pb-24">
        <Section title="What we collect">
          <Facts
            items={[
              ['Your account', 'Name, username, email address and password (stored only as a one-way hash, never as the password itself), plus a phone number and other profile details if you add them.'],
              ['Your bookings', 'The car, dates, pickup hub, price, payment method and payment status, and the driver details you enter: name, email, phone, address, date of birth, driving licence number, ID document type and number, an emergency contact and any special requests.'],
              ['Messages', 'What you send through the Contact page: name, email, phone, subject and message.'],
              ['Email alerts', 'Your email address, if you subscribe to promo codes or ask to be told when a car is free.'],
              ['Reviews', 'The rating and text you leave after a completed trip. Reviews are public.'],
              ['In your browser', 'Your sign-in token and basic account details (name, email, role) in local storage, your light or dark theme choice, and the trip details you picked on the home page. The site sets no cookies and uses no advertising or analytics trackers.'],
            ]}
          />
        </Section>

        <Section title="Why">
          <p>
            To run your account and your bookings, to produce invoices and booking emails (sent to your account email), to let
            the team check the driver&apos;s licence and ID at pickup, to answer your messages, and to send the alerts you asked
            for. Nothing is sold or used for advertising.
          </p>
        </Section>

        <Section title="Who can see it">
          <p>
            The Driveaway admin team can see accounts, bookings and messages, so they can manage the fleet and help you.
          </p>
          <p>
            The demo runs on hosted services: the database on MongoDB Atlas, the server on Render and the website on Vercel.
            Emails are sent through an email provider (Brevo, or an SMTP mail service). Car photos load from Wikimedia Commons and
            Unsplash and the typeface from Google Fonts, so those services see your IP address, as with any website that uses
            them.
          </p>
        </Section>

        <Section title="Payments">
          <p>
            The online checkout is a simulation. It never asks for real card, UPI or bank details. A paid booking stores only
            the payment method you picked and a test payment reference.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            Update your profile any time in <Link to="/dashboard" className="text-ink underline">My garage</Link>. Every promo
            email has a one-click unsubscribe link.
          </p>
          <p>
            To delete your account, ask through the Contact page. Once you have no upcoming bookings, an admin can delete it:
            your account, reviews and alerts are removed, and your name and driver details are wiped from past bookings. The
            booking records themselves stay, without them, for the business records.
          </p>
        </Section>

        <Section title="Questions">
          <p>Anything about your data you want to know or change? Send us a message.</p>
          <p>
            <Link to="/contact" className="btn-ink">Contact Driveaway <ArrowRight className="h-4 w-4" /></Link>
          </p>
        </Section>
      </div>
    </div>
  );
}
