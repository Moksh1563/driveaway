import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { paintStyle } from '../theme/paints';

export default function NotFoundPage() {
  return (
    <section style={paintStyle('Sedan')} className="lacquer on-paint min-h-screen pt-[72px]">
      <div className="page-container flex min-h-[calc(100vh-72px)] flex-col justify-center py-20">
        <h1 className="display text-[clamp(3rem,9vw,6rem)]">Wrong turn.</h1>
        <p className="mt-6 max-w-md text-lg">This page is not in our book. The cars are still where you left them.</p>
        <p className="mt-3 code-label text-[13px]">Error 404</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/fleet" className="btn !bg-on-paint !text-paint !px-7 !py-4">Browse the fleet <ArrowRight className="h-4 w-4" /></Link>
          <Link to="/" className="btn border border-on-paint/40 !px-7 !py-4 hover:border-on-paint">Go home</Link>
        </div>
      </div>
    </section>
  );
}
