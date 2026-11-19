import React from 'react';
import { Check } from 'lucide-react';
import { PAINTS, PAINT_ORDER, paintStyle } from '../../theme/paints';
import { PASSWORD_RULES } from '../../hooks/useFieldErrors';
import RisingWords from '../ui/RisingWords';

/**
 * Split layout for sign-in and sign-up: a lacquered paint panel beside the form.
 * The paint panel carries the page's single headline; the form side stays neutral.
 * The form is the task, so it carries no entrance of its own (the page settle is enough) and is
 * sharp and ready at once, while the panel's headline words rise from their masks and the paint
 * chips are dealt onto its floor.
 */
export default function AuthShell({ paint = 'Supercar', title, lead, children }) {
  return (
    <div className="grid min-h-screen pt-[72px] lg:grid-cols-2">
      <section style={paintStyle(paint)} className="lacquer on-paint relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between">
        <div className="px-12 pt-16 xl:px-16">
          <h1 className="display text-[clamp(3rem,5.6vw,5.5rem)]"><RisingWords text={title} /></h1>
          <p className="focus-in mt-6 max-w-sm text-lg leading-snug" style={{ '--d': '260ms', '--rise': '10px' }}>{lead}</p>
        </div>
        {/* The paint book, standing on the panel's floor */}
        <div className="flex items-end gap-2 px-12 xl:px-16" aria-hidden="true">
          {PAINT_ORDER.slice(0, 5).map((t, i) => (
            <span
              key={t}
              className={`enter-deal rounded-t-[14px] border border-b-0 border-white/25 ${t === paint ? 'h-36' : 'h-24'}`}
              style={{ background: PAINTS[t].hex, width: `${64 + (t === paint ? 24 : 0)}px`, marginBottom: i % 2 ? -6 : 0, '--d': `${200 + i * 80}ms`, '--tilt': `${i % 2 ? 4 : -4}deg` }}
            />
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <h1 className="display mb-8 text-4xl lg:hidden" style={paintStyle(paint)}>{title}</h1>
          {children}
        </div>
      </section>
    </div>
  );
}

/** The live password checklist shared by sign-up and password reset: each tick firms up as its rule is met. */
export function PasswordChecklist({ password }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Password requirements">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password || '');
        return (
          <li key={r.label} className={`flex items-center gap-1.5 transition-colors duration-200 ${ok ? 'text-ok' : 'text-muted'}`}>
            <Check className={`h-3.5 w-3.5 transition-[opacity,transform] duration-200 ease-out ${ok ? '' : 'scale-75 opacity-30'}`} /> {r.label}
          </li>
        );
      })}
    </ul>
  );
}
