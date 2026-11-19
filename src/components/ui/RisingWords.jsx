import React from 'react';

/**
 * Display headline text whose words rise one after another from behind their own mask.
 * Screen readers get the plain sentence; the animated copy is hidden from them. The animation
 * uses fill "backwards" (the words rest in place by default, no script needed) and the global
 * reduced-motion rule collapses it, so the words simply appear.
 *
 *   <h1 className="display ..."><RisingWords text="Wrong turn." /></h1>
 */
export default function RisingWords({ text, delay = 80, step = 60, duration = 620 }) {
  const words = String(text ?? '').split(' ');
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <React.Fragment key={`${i}-${word}`}>
            <span className="-mb-[0.08em] inline-block overflow-hidden pb-[0.08em] align-bottom">
              <span
                className="inline-block"
                style={{ animation: `line-up ${duration}ms var(--ease-out) ${delay + i * step}ms backwards` }}
              >
                {word}
              </span>
            </span>
            {i < words.length - 1 ? ' ' : null}
          </React.Fragment>
        ))}
      </span>
    </>
  );
}
