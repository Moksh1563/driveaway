// Server copy of the website's paint book (src/theme/paints.js): every car category owns one paint.
// `on` is the text colour that stays readable on that paint.
const PAINTS = {
  Hypercar:  { no: '01', name: 'French Racing Blue', hex: '#1F3C88', on: '#FFFFFF' },
  Supercar:  { no: '02', name: 'Rosso Corsa',        hex: '#D0021B', on: '#FFFFFF' },
  Luxury:    { no: '03', name: 'Racing Green',       hex: '#0F4D2E', on: '#FFFFFF' },
  SUV:       { no: '04', name: 'Giallo',             hex: '#F2B705', on: '#111113' },
  Electric:  { no: '05', name: 'Voltage Teal',       hex: '#0B7785', on: '#FFFFFF' },
  Sports:    { no: '06', name: 'Arancio',            hex: '#E8590C', on: '#111113' },
  Sedan:     { no: '07', name: 'Graphite',           hex: '#4A4E57', on: '#FFFFFF' },
  Hatchback: { no: '08', name: 'Lilac',              hex: '#7B61C9', on: '#FFFFFF' },
};

const PAINT_ORDER = ['Hypercar', 'Supercar', 'Luxury', 'SUV', 'Electric', 'Sports', 'Sedan', 'Hatchback'];

/** The house ink, for emails that are not about one car (offers, account, contact, tests). */
const HOUSE_PAINT = { no: '00', name: 'Driveaway Ink', hex: '#111113', on: '#FFFFFF', type: null };

/**
 * Paint for a car category. An unknown or missing category gets Graphite, the same fallback the
 * website uses, without a paint label (type: null).
 */
const paintFor = (type) => (PAINTS[type] ? { ...PAINTS[type], type } : { ...PAINTS.Sedan, type: null });

module.exports = { PAINTS, PAINT_ORDER, HOUSE_PAINT, paintFor };
