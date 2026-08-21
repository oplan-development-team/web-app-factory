// Generates src/data/stars.json and src/data/constellations.json.
//
// Source: the sky data bundled with d3-celestial (BSD-3-Clause, (c) Olaf
// Frohn), which derives its star positions from the Hipparcos catalogue and
// its constellation figures from the conventional stick-figure asterisms.
//
// d3-celestial is a *build-time* dependency only. Its full 6th-magnitude set
// is 657 KB; this script narrows it to the 4.5-magnitude limit the poster
// draws (FR-106.2), drops the fields the poster does not use, and writes the
// result into src/data/ where it is committed. Nothing is fetched at runtime
// (NFR-001.1).
//
// The prototype this replaces hand-compiled ~150 real stars and then padded
// the catalogue to ~490 with uniformly random "filler" stars. That padding is
// removed: a chart whose whole premise is that it plots measured observations
// must not invent 70% of what it plots.

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'src', 'data');
const dataDir = join(dirname(require.resolve('d3-celestial/package.json')), 'data');

/** Visual magnitude limit. See SPEC FR-106.2 and section 9.3 for the rationale. */
const MAGNITUDE_LIMIT = 4.5;

/**
 * Coordinate precision. 3 decimal places is 3.6 arcseconds, roughly a
 * thousandth of the chart radius -- far finer than the poster can resolve, and
 * far coarser than the error already accepted by skipping precession.
 */
const COORD_DECIMALS = 3;

function readData(name) {
  return JSON.parse(readFileSync(join(dataDir, name), 'utf8'));
}

const round = (n) => Number(n.toFixed(COORD_DECIMALS));
/** d3-celestial stores right ascension as a longitude in [-180, 180). */
const toRightAscension = (lon) => round(((lon % 360) + 360) % 360);

// --- Stars -----------------------------------------------------------------

const starFeatures = readData('stars.6.json').features;
const starNames = readData('starnames.json');

const stars = starFeatures
  .filter((feature) => feature.properties.mag <= MAGNITUDE_LIMIT)
  .map((feature) => {
    const designation = starNames[feature.id] ?? {};
    const [lon, lat] = feature.geometry.coordinates;

    /** @type {Record<string, unknown>} */
    const star = {
      id: `HIP${feature.id}`,
      ra: toRightAscension(lon),
      dec: round(lat),
      mag: feature.properties.mag,
    };
    if (designation.name) star.name = designation.name;
    if (designation.bayer) star.bayer = designation.bayer;
    if (designation.c) star.con = designation.c;
    return star;
  })
  .sort((a, b) => a.mag - b.mag);

// --- Constellation figures -------------------------------------------------

// Serpens is the one constellation split into two disjoint halves, so both the
// metadata and the figure files carry two features under the id "Ser". Pairing
// them positionally rather than by id keeps Caput from inheriting Cauda's name.
const metaByAbbreviation = new Map();
for (const feature of readData('constellations.json').features) {
  const queue = metaByAbbreviation.get(feature.id) ?? [];
  queue.push(feature.properties.name);
  metaByAbbreviation.set(feature.id, queue);
}

const constellations = readData('constellations.lines.json').features.map((feature) => ({
  con: feature.id,
  name: metaByAbbreviation.get(feature.id)?.shift() ?? feature.id,
  lines: feature.geometry.coordinates.map((line) =>
    line.map(([lon, lat]) => [toRightAscension(lon), round(lat)]),
  ),
}));

// --- Integrity checks ------------------------------------------------------
//
// This script reads the internal file layout of a third-party package. If a
// future version reshapes that layout, failing loudly here is far better than
// silently emitting an empty or malformed catalogue that only shows up as a
// blank poster.

function assert(condition, message) {
  if (!condition) throw new Error(`Catalog generation failed: ${message}`);
}

assert(stars.length > 800, `expected 800+ stars at magnitude ${MAGNITUDE_LIMIT}, got ${stars.length}`);
assert(
  stars.every(
    (s) =>
      Number.isFinite(s.ra) &&
      s.ra >= 0 &&
      s.ra < 360 &&
      Number.isFinite(s.dec) &&
      s.dec >= -90 &&
      s.dec <= 90 &&
      Number.isFinite(s.mag),
  ),
  'a star has coordinates outside the valid range',
);
assert(new Set(stars.map((s) => s.id)).size === stars.length, 'duplicate star ids');
assert(
  stars.some((s) => s.name === 'Sirius' && Math.abs(s.ra - 101.287) < 0.01),
  'Sirius is missing or misplaced -- the upstream data shape has probably changed',
);
assert(
  stars.filter((s) => s.name).length > 300,
  'too few stars carry a proper name; the starnames join has probably broken',
);

assert(
  constellations.length >= 88,
  `expected all 88 IAU constellations, got ${constellations.length}`,
);
assert(
  new Set(constellations.map((c) => c.name)).size === constellations.length,
  'two constellation figures share a name -- the positional metadata pairing has broken',
);
assert(
  constellations.every((c) => c.lines.length > 0 && c.lines.every((l) => l.length >= 2)),
  'a constellation has an empty or degenerate figure line',
);
assert(
  constellations.every((c) =>
    c.lines.every((l) =>
      l.every(([ra, dec]) => ra >= 0 && ra < 360 && dec >= -90 && dec <= 90),
    ),
  ),
  'a constellation line vertex is outside the valid coordinate range',
);

// --- Write -----------------------------------------------------------------

writeFileSync(join(outDir, 'stars.json'), JSON.stringify(stars));
writeFileSync(join(outDir, 'constellations.json'), JSON.stringify(constellations));

const segments = constellations.reduce(
  (total, c) => total + c.lines.reduce((n, line) => n + line.length - 1, 0),
  0,
);
console.log(
  `stars.json: ${stars.length} stars (<= ${MAGNITUDE_LIMIT}m, ` +
    `${stars.filter((s) => s.name).length} with proper names)`,
);
console.log(`constellations.json: ${constellations.length} figures, ${segments} segments`);
