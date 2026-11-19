import React from 'react';

// Drops 4px into place as it fades in (200ms). No height animation: the form below makes room at
// once, so nothing slides around under the pointer. A changed message plays it again.
export const ERROR_IN = 'animate-[rise_200ms_var(--ease-out)_backwards] [--rise:-4px]';

/** The message under an invalid field; its id is what the input's aria-describedby points at. */
export default function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p key={String(children)} id={id} className={`mt-1.5 text-xs font-semibold text-danger dark:text-[#F28B82] ${ERROR_IN}`}>
      {children}
    </p>
  );
}
