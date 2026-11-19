import React from 'react';

/** The message under an invalid field; its id is what the input's aria-describedby points at. */
export default function FieldError({ id, children }) {
  if (!children) return null;
  return <p id={id} className="mt-1.5 text-xs font-semibold text-danger dark:text-[#F28B82]">{children}</p>;
}
