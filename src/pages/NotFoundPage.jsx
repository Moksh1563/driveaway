import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { paintStyle } from '../theme/paints';
import RisingWords from '../components/ui/RisingWords';

// On arrival a band of clear-coat light crosses the graphite field once, the headline's words rise
// from their masks, the line under it comes into focus and the way out follows.
export default function NotFoundPage() {
  return (
    <section style={paintStyle('Sedan')} className="lacquer on-paint min-h-screen pt-[72px]">
      <span className="sheen-sweep" aria-hidden="true" />
      <div className="page-container flex min-h-[calc(100vh-72px)] flex-col justify-center py-20">
        <h1 className="display text-[clamp(3rem,9vw,6rem)]"><RisingWords text="Wrong turn." step={90} /></h1>
        <p className="focus-in mt-6 max-w-md text-lg" style={{ '--d': '240ms', '--rise': '10px' }}>This page is not in our book. The cars are still where you left them.</p>
        <p className="focus-in mt-3 code-label text-[13px]" style={{ '--d': '320ms', '--rise': '8px' }}>Error 404</p>
        <div className="enter mt-10 flex flex-wrap gap-3" style={{ '--d': '420ms', '--rise': '12px' }}>
          <Link to="/fleet" className="btn !bg-on-paint !text-paint !px-7 !py-4">Browse the fleet <ArrowRight className="h-4 w-4" /></Link>
          <Link to="/" className="btn border border-on-paint/40 !px-7 !py-4 transition-[border-color,transform] hover:border-on-paint">Go home</Link>
        </div>
      </div>
    </section>
  );
}
