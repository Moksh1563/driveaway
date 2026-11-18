import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PAINTS, PAINT_ORDER, paintStyle } from '../theme/paints';
import { HUBS } from '../theme/hubs';
import Reveal from '../components/ui/Reveal';

const PROMISES = [
  { title: 'Fully insured', desc: 'Every car carries comprehensive insurance for the length of your rental.' },
  { title: 'Eight hubs', desc: 'Collect and return at SG Highway, the airport, Vastrapur, Bopal and four more.' },
  { title: 'Support all day', desc: 'Our Ahmedabad team answers calls daily from 7:00 AM to 10:00 PM.' },
  { title: 'Book in minutes', desc: 'Pick the car, the dates and a hub. No hidden charges and free cancellation.' },
];

export default function AboutPage() {
  return (
    <div className="pt-[72px]">
      {/* Story */}
      <section className="page-container grid gap-12 py-20 lg:grid-cols-12 lg:py-28">
        <h1 className="display text-[clamp(2.8rem,6.5vw,6rem)] lg:col-span-7">
          A paint book of fast cars.
        </h1>
        <div className="space-y-5 text-lg leading-relaxed text-muted lg:col-span-5 lg:pt-4">
          <p>
            Driveaway started in Ahmedabad with a small fleet and one idea: renting an exceptional car should feel as easy as
            booking a cab.
          </p>
          <p>
            Today the fleet runs from track-bred hypercars to quiet luxury saloons. Each category has its own factory paint, so you
            can find the kind of drive you want at a glance, then collect it from a hub near you.
          </p>
          <Link to="/fleet" className="btn-ink !mt-8">See the fleet <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      {/* The paint book, full width */}
      <Reveal as="section" variant="deal" stagger={70} aria-label="Our categories" className="overflow-hidden grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
        {PAINT_ORDER.map((t) => (
          <Link
            key={t}
            to={`/fleet?type=${t}`}
            style={paintStyle(t)}
            className="lacquer on-paint group flex aspect-[3/4] flex-col justify-between p-5 transition-[filter] hover:brightness-110"
          >
            <span className="code-label text-[11px]">Paint {PAINTS[t].no}</span>
            <span>
              <span className="block font-wide font-black uppercase tracking-tight text-[clamp(0.95rem,1.2vw,1.125rem)] leading-none">{t}</span>
              <span className="mt-1 block text-xs">{PAINTS[t].name}</span>
            </span>
          </Link>
        ))}
      </Reveal>

      {/* Promises */}
      <section className="page-container py-20 lg:py-24">
        <h2 className="display text-4xl sm:text-5xl">What you can count on.</h2>
        <dl className="mt-12 grid gap-px overflow-hidden rounded-chip border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map((p) => (
            <div key={p.title} className="bg-ground p-7">
              <dt className="font-wide font-black uppercase tracking-tight text-lg">{p.title}</dt>
              <dd className="mt-3 text-sm leading-relaxed text-muted">{p.desc}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Hubs */}
      <section className="page-container border-t border-line py-20 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-12">
          <h2 className="display text-4xl sm:text-5xl lg:col-span-5">Serving all of Ahmedabad.</h2>
          <ul className="flex flex-wrap content-start gap-2 lg:col-span-7">
            {HUBS.map((h) => (
              <li key={h}>
                <Link to={`/fleet?location=${encodeURIComponent(h)}`} className="inline-block rounded-full border border-line px-4 py-2.5 text-sm font-semibold hover:border-ink">
                  {h}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
