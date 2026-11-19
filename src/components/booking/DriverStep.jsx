import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import Button from '../ui/Button';
import FieldError, { ERROR_IN } from './FieldError';
import { FIELD_CLASS, OPTIONAL_DRIVER_FIELDS } from './driverFields';

// Opening the fold: its fields drop 6px into place as they fade in
const FOLD_IN = 'group-open:animate-[rise_260ms_var(--ease-out)_backwards] [--rise:-6px]';

/**
 * Step 2 of booking: the three required driver fields up front, everything else folded into
 * "More details (optional)". useFieldErrors opens the fold when it focuses an invalid field inside.
 */
export default function DriverStep({ form, set, errors, field, errorId, accountEmail, dobMax, onBack, onNext }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const optionalError = OPTIONAL_DRIVER_FIELDS.some((k) => errors[k]);
  const prefilled = OPTIONAL_DRIVER_FIELDS.filter((k) => k !== 'specialRequirements' && form[k]).length;

  const input = (name, label, props = {}) => (
    <label className={`block ${props.wide ? 'sm:col-span-2' : ''}`}>
      <span className="field-label">{label}</span>
      <input value={form[name]} onChange={set(name)} {...field(name)} {...props.input} className={FIELD_CLASS} />
      <FieldError id={errorId(name)}>{errors[name]}</FieldError>
    </label>
  );

  return (
    <fieldset className="space-y-5">
      <legend className="font-wide font-black uppercase tracking-tight text-xl">Who is driving</legend>
      <p className="!mt-2 text-sm text-muted">Bring the same licence and an original ID when you collect the car. These three are all we need.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {input('customerName', 'Full name *', { input: { autoComplete: 'name', required: true } })}
        {input('customerPhone', 'Mobile number *', { input: { type: 'tel', autoComplete: 'tel', inputMode: 'tel', required: true, placeholder: '98765 43210' } })}
        {input('licenseNumber', 'Driving licence number *', { wide: true, input: { required: true, placeholder: 'GJ01 2020 0001234', autoCapitalize: 'characters' } })}
      </div>

      <details open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)} className="group rounded-chip border border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
          <span>
            More details (optional)
            {optionalError ? (
              <span className={`ml-2 text-sm font-semibold text-danger dark:text-[#F28B82] ${ERROR_IN}`}>Check the marked fields</span>
            ) : prefilled > 0 && (
              <span className="ml-2 text-sm font-normal text-muted">{prefilled} filled in from your profile</span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 transition-transform duration-300 ease-out group-open:rotate-180" aria-hidden="true" />
        </summary>
        {/* The fold's fields settle in as it opens (CSS on [open], so it also plays when validation opens it) */}
        <div className={`grid gap-4 border-t border-line p-5 sm:grid-cols-2 ${FOLD_IN}`}>
          <div className="sm:col-span-2">
            {input('customerEmail', 'Contact email', { input: { type: 'email', autoComplete: 'email' } })}
            {accountEmail && <p className="mt-1.5 text-xs text-muted">Confirmations and invoices always go to your account email, {accountEmail}.</p>}
          </div>
          {input('dateOfBirth', 'Date of birth', { input: { type: 'date', max: dobMax, min: '1900-01-01' } })}
          <label className="block">
            <span className="field-label">ID proof</span>
            <select value={form.idProofType} onChange={set('idProofType')} className="field">
              <option value="">Choose an ID</option>
              {['Aadhaar Card', 'PAN Card', 'Passport', 'Voter ID'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          {input('idProofNumber', 'ID number')}
          {input('address', 'Address', { input: { autoComplete: 'street-address' } })}
          {input('emergencyContact', 'Emergency contact')}
          {input('emergencyPhone', 'Emergency phone', { input: { type: 'tel', inputMode: 'tel' } })}
          <label className="block sm:col-span-2">
            <span className="field-label">Requests</span>
            <textarea rows={3} value={form.specialRequirements} onChange={set('specialRequirements')} maxLength={300} placeholder="Airport terminal meet-up, child seat, extra luggage space…" className="field resize-none" />
          </label>
        </div>
      </details>

      <div className="flex flex-wrap gap-3 pt-2">
        <Button variant="secondary" onClick={onBack}><ChevronLeft className="h-4 w-4" /> Back</Button>
        <Button onClick={onNext} className="!px-8">Review booking <ChevronRight className="h-4 w-4" /></Button>
      </div>
    </fieldset>
  );
}
