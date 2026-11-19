import { useCallback, useEffect, useRef, useState } from 'react';

// Shared input rules for the booking, sign-up and password forms
export const normalisePhone = (v) => String(v || '').replace(/[\s\-().]/g, '');
export const isIndianMobile = (v) => /^(\+?91)?[6-9]\d{9}$/.test(normalisePhone(v));
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
// Lenient Indian driving licence check: state code, then 8 to 16 letters/digits once separators are removed
export const isLicence = (v) => /^[A-Z]{2}\d[0-9A-Z]{7,15}$/i.test(String(v || '').replace(/[\s\-/.]/g, ''));

// Same rule as the server: 8 to 128 characters with a letter and a number
export const PASSWORD_RULES = [
  { test: (p) => p.length >= 8 && p.length <= 128, label: '8 to 128 characters' },
  { test: (p) => /[A-Za-z]/.test(p), label: 'A letter' },
  { test: (p) => /\d/.test(p), label: 'A number' },
];
export const passwordOk = (p) => PASSWORD_RULES.every((r) => r.test(p || ''));

/**
 * Inline field errors: `field(name)` gives an input its ref, aria-invalid and aria-describedby;
 * `check(errors, order)` stores a validation result and focuses the first invalid field
 * (after the render that shows it, so fields on a step or inside a disclosure exist by then).
 */
export default function useFieldErrors(prefix = 'err') {
  const [errors, setErrors] = useState({});
  const [focusRequest, setFocusRequest] = useState(null);
  const refs = useRef({});

  const errorId = useCallback((name) => `${prefix}-${name}`, [prefix]);

  const field = useCallback((name) => ({
    ref: (el) => { if (el) refs.current[name] = el; else delete refs.current[name]; },
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${prefix}-${name}` : undefined,
  }), [errors, prefix]);

  const clear = useCallback((name) => {
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const check = useCallback((next, order) => {
    setErrors(next);
    const first = order.find((k) => next[k]);
    if (first) setFocusRequest({ name: first, at: Date.now() });
    return !first;
  }, []);

  useEffect(() => {
    const el = focusRequest && refs.current[focusRequest.name];
    if (!el) return;
    // A field folded inside a closed <details> cannot take focus until it is opened
    for (let d = el.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true;
    el.focus();
  }, [focusRequest]);

  return { errors, field, errorId, clear, check, setErrors };
}
