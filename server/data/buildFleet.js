/**
 * Builds Car documents from data/fleet.js + data/fleetPhotos.json.
 * Every car gets four photos of that exact model (main + 3 more angles) with author/licence credits.
 */
const path = require('path');
const fs = require('fs');
const fleet = require('./fleet');

const PHOTOS_FILE = path.join(__dirname, 'fleetPhotos.json');

function loadPhotos() {
  if (!fs.existsSync(PHOTOS_FILE)) {
    throw new Error('data/fleetPhotos.json is missing. Run scripts/fetchFleetPhotos.py first (see its header).');
  }
  return JSON.parse(fs.readFileSync(PHOTOS_FILE, 'utf-8'));
}

module.exports = function buildFleet() {
  const photos = loadPhotos();
  return fleet.map(({ commons, ...car }) => {
    const entry = photos[car.name];
    const list = (entry && entry.photos) || [];
    if (list.length < 4) throw new Error(`Only ${list.length} photos for ${car.name}`);
    const [main, img1, img2, img3] = list;
    return {
      ...car,
      status: 'Available',
      images: { main: main.thumb, img1: img1.thumb, img2: img2.thumb, img3: img3.thumb, img4: '' },
      imageCredits: list.slice(0, 4).map((p) => ({
        url: p.thumb,
        author: p.author,
        license: p.license,
        source: p.page,
      })),
    };
  });
};
