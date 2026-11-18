// Driveaway's paint book: every car category owns one factory paint.
// `on` is the text colour that stays readable on that paint.

export const PAINTS = {
  Hypercar:  { no: '01', name: 'French Racing Blue', hex: '#1F3C88', rgb: '31 60 136',  on: '255 255 255' },
  Supercar:  { no: '02', name: 'Rosso Corsa',        hex: '#D0021B', rgb: '208 2 27',   on: '255 255 255' },
  Luxury:    { no: '03', name: 'Racing Green',       hex: '#0F4D2E', rgb: '15 77 46',   on: '255 255 255' },
  SUV:       { no: '04', name: 'Giallo',             hex: '#F2B705', rgb: '242 183 5',  on: '17 17 19' },
  Electric:  { no: '05', name: 'Voltage Teal',       hex: '#0B7785', rgb: '11 119 133', on: '255 255 255' },
  Sports:    { no: '06', name: 'Arancio',            hex: '#E8590C', rgb: '232 89 12',  on: '17 17 19' },
  Sedan:     { no: '07', name: 'Graphite',           hex: '#4A4E57', rgb: '74 78 87',   on: '255 255 255' },
  Hatchback: { no: '08', name: 'Lilac',              hex: '#7B61C9', rgb: '123 97 201', on: '255 255 255' },
};

export const PAINT_ORDER = ['Hypercar', 'Supercar', 'Luxury', 'SUV', 'Electric', 'Sports', 'Sedan', 'Hatchback'];

const FALLBACK = PAINTS.Sedan;

export const paintFor = (type) => PAINTS[type] || FALLBACK;

/** Inline style that sets the current paint for a region (used with bg-paint / text-on-paint). */
export const paintStyle = (type) => {
  const p = paintFor(type);
  return { '--paint': p.rgb, '--on-paint': p.on };
};

// Category names as plural nouns: "Hypercars", "SUVs", but "Sports cars", "Electric cars", "Luxury cars"
const ADJECTIVE_TYPES = ['Luxury', 'Sports', 'Electric'];
export const plural = (type) => (ADJECTIVE_TYPES.includes(type) ? `${type} cars` : `${type}s`);

export const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** Lower-case plural for running text, keeping acronyms intact ("SUVs", "supercars"). */
export const pluralLower = (type) => (type === type.toUpperCase() ? `${type}s` : plural(type).toLowerCase());

/** "McLaren Senna" stays as is; "Spectre" from Rolls-Royce becomes "Rolls-Royce Spectre". */
const firstWord = (s) => s.toLowerCase().split(/[\s-]/)[0];
export const carTitle = (car) => {
  const name = (car?.name || '').trim();
  const company = (car?.company || '').trim();
  return company && firstWord(name) !== firstWord(company) ? `${company} ${name}` : name;
};
