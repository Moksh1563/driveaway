import React, { Children, cloneElement, isValidElement, useEffect, useRef, useState } from 'react';

/**
 * Animates its direct children in when the group scrolls into view (once).
 * - variant: 'rise' (default), 'deal' (chips/cards dealt with a slight tilt), 'slide' (from the left)
 * - stagger: ms between children (capped in CSS so long lists never lag)
 * - wrap: wrap each child in a div — needed when children are components that ignore `style`
 * Content is only hidden for the moment before the observer fires; without IntersectionObserver
 * everything shows immediately.
 */
export default function Reveal({
  as: Tag = 'div',
  variant = 'rise',
  stagger = 40,
  delay = 0,
  wrap = false,
  cellClassName = '',
  className = '',
  style,
  children,
  ...rest
}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Once the first entrance has played, items that arrive later (a filter change, a new tab)
  // come in quickly with no stagger instead of replaying the whole entrance.
  useEffect(() => {
    if (!shown) return undefined;
    const t = setTimeout(() => setSettled(true), delay + 5 * stagger + 500);
    return () => clearTimeout(t);
  }, [shown, delay, stagger]);

  let i = 0;
  const items = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const index = i++;
    if (wrap) {
      return (
        <div className={cellClassName} style={{ '--i': index }}>
          {child}
        </div>
      );
    }
    return cloneElement(child, { style: { ...child.props.style, '--i': index } });
  });

  return (
    <Tag
      ref={ref}
      data-reveal={variant}
      data-shown={shown}
      className={className}
      style={{
        ...style,
        '--stagger': `${settled ? 0 : stagger}ms`,
        '--delay': `${settled ? 0 : delay}ms`,
        ...(settled ? { '--reveal-dur': '150ms', '--rise': '6px' } : {}),
      }}
      {...rest}
    >
      {items}
    </Tag>
  );
}
