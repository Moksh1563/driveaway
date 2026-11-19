/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  // hover: styles only where a real pointer hovers, so taps on phones don't trigger them
  future: { hoverOnlyWhenSupported: true },
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Archivo', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Neutral world: primer (light) / clear-coat (dark). All chrome uses these.
        ground: token('ground'),
        surface: token('surface'),
        raised: token('raised'),
        ink: token('ink'),
        muted: token('muted'),
        line: token('line'),
        // The paint currently on show (set per page/section via --paint / --on-paint)
        paint: token('paint'),
        'on-paint': token('on-paint'),
        // Fixed factory paints (one per car category)
        lacquer: {
          blue: '#1F3C88',
          red: '#D0021B',
          green: '#0F4D2E',
          yellow: '#F2B705',
          teal: '#0B7785',
          orange: '#E8590C',
          graphite: '#4A4E57',
          lilac: '#7B61C9',
        },
        // Status colours are theme tokens (index.css), tuned so text-ok / text-warn / text-danger
        // pass WCAG AA in both themes
        ok: token('ok'),
        warn: token('warn'),
        danger: token('danger'),
      },
      borderRadius: {
        chip: '18px',
      },
      boxShadow: {
        chip: '0 1px 0 rgb(255 255 255 / 0.18) inset, 0 18px 40px -18px rgb(0 0 0 / 0.55)',
        lift: '0 24px 60px -24px rgb(0 0 0 / 0.45)',
        soft: '0 8px 24px -12px rgb(0 0 0 / 0.25)',
      },
      // Named curves (charles-ux-animation): ease-out to appear, ease-in to leave, ease-in-out to move
      transitionTimingFunction: {
        out: 'cubic-bezier(0.32, 0.72, 0, 1)',
        in: 'cubic-bezier(0.55, 0, 1, 0.45)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
      },
      keyframes: {
        wipe: {
          '0%': { clipPath: 'circle(0% at var(--wipe-x, 50%) 100%)' },
          '100%': { clipPath: 'circle(150% at var(--wipe-x, 50%) 100%)' },
        },
      },
      animation: {
        wipe: 'wipe 620ms cubic-bezier(0.65, 0, 0.35, 1) both',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
