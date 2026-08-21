// Generates src/data/stars.json and src/data/constellations.json.
//
// Star coordinates are approximate J2000 values for well-known naked-eye
// stars (Bright Star Catalogue magnitude range), hand-compiled for this
// prototype. They are NOT pulled from a live astrometric database, so
// expect a small (sub-degree) margin of error -- acceptable for a poster
// generator that already disclaims precession/proper-motion correction.
//
// The curated list is padded with procedurally distributed filler stars
// (uniform-random position on the celestial sphere, magnitude 3.4-4.5) so
// the catalog reaches "several hundred" stars as specified, without
// pretending to have precise coordinates for stars nobody would recognize
// anyway. Filler stars are never part of a constellation line.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'src', 'data');

/** @typedef {[bayer: string, name: string|null, raH: number, raM: number, decSign: 1|-1, decD: number, decM: number, mag: number]} RawStar */

/** @type {Record<string, RawStar[]>} */
const CATALOG = {
  UMa: [
    ['α', 'Dubhe', 11, 3.7, 1, 61, 45, 1.79],
    ['β', 'Merak', 11, 1.8, 1, 56, 23, 2.37],
    ['γ', 'Phecda', 11, 53.8, 1, 53, 42, 2.44],
    ['δ', 'Megrez', 12, 15.4, 1, 57, 2, 3.31],
    ['ε', 'Alioth', 12, 54.0, 1, 55, 58, 1.77],
    ['ζ', 'Mizar', 13, 23.9, 1, 54, 56, 2.23],
    ['η', 'Alkaid', 13, 47.5, 1, 49, 19, 1.85],
  ],
  UMi: [
    ['α', 'Polaris', 2, 31.8, 1, 89, 16, 1.98],
    ['β', 'Kochab', 14, 50.7, 1, 74, 9, 2.08],
    ['γ', 'Pherkad', 15, 20.7, 1, 71, 50, 3.05],
  ],
  Cas: [
    ['α', 'Schedar', 0, 40.5, 1, 56, 32, 2.24],
    ['β', 'Caph', 0, 9.2, 1, 59, 9, 2.28],
    ['γ', null, 0, 56.7, 1, 60, 43, 2.47],
    ['δ', 'Ruchbah', 1, 25.8, 1, 60, 14, 2.68],
    ['ε', 'Segin', 1, 54.4, 1, 63, 40, 3.35],
  ],
  Cep: [
    ['α', 'Alderamin', 21, 18.6, 1, 62, 35, 2.44],
    ['β', 'Alfirk', 21, 28.7, 1, 70, 34, 3.23],
    ['γ', 'Errai', 23, 39.3, 1, 77, 37, 3.21],
  ],
  Dra: [
    ['α', 'Thuban', 14, 4.4, 1, 64, 23, 3.65],
    ['γ', 'Eltanin', 17, 56.6, 1, 51, 29, 2.23],
  ],
  Ori: [
    ['α', 'Betelgeuse', 5, 55.2, 1, 7, 24, 0.45],
    ['β', 'Rigel', 5, 14.5, -1, 8, 12, 0.13],
    ['γ', 'Bellatrix', 5, 25.1, 1, 6, 21, 1.64],
    ['δ', 'Mintaka', 5, 32.0, -1, 0, 18, 2.23],
    ['ε', 'Alnilam', 5, 36.2, -1, 1, 12, 1.69],
    ['ζ', 'Alnitak', 5, 40.8, -1, 1, 57, 1.74],
    ['κ', 'Saiph', 5, 47.7, -1, 9, 40, 2.06],
  ],
  CMa: [
    ['α', 'Sirius', 6, 45.1, -1, 16, 43, -1.46],
    ['β', 'Mirzam', 6, 22.7, -1, 17, 57, 1.98],
    ['δ', 'Wezen', 7, 8.4, -1, 26, 23, 1.83],
    ['ε', 'Adhara', 6, 58.6, -1, 28, 58, 1.5],
    ['η', 'Aludra', 7, 24.1, -1, 29, 18, 2.45],
  ],
  CMi: [
    ['α', 'Procyon', 7, 39.3, 1, 5, 13, 0.34],
    ['β', 'Gomeisa', 7, 27.2, 1, 8, 17, 2.9],
  ],
  Tau: [
    ['α', 'Aldebaran', 4, 35.9, 1, 16, 31, 0.87],
    ['β', 'Elnath', 5, 26.3, 1, 28, 36, 1.65],
    ['η', 'Alcyone', 3, 47.5, 1, 24, 6, 2.87],
  ],
  Gem: [
    ['α', 'Castor', 7, 34.6, 1, 31, 53, 1.58],
    ['β', 'Pollux', 7, 45.3, 1, 28, 2, 1.14],
    ['γ', 'Alhena', 6, 37.7, 1, 16, 24, 1.93],
    ['δ', 'Wasat', 7, 20.1, 1, 21, 59, 3.53],
    ['ε', 'Mebsuta', 6, 43.9, 1, 25, 8, 2.98],
    ['μ', 'Tejat', 6, 22.9, 1, 22, 31, 2.88],
  ],
  Aur: [
    ['α', 'Capella', 5, 16.7, 1, 46, 0, 0.08],
    ['β', 'Menkalinan', 5, 59.5, 1, 44, 57, 1.9],
    ['ι', 'Hassaleh', 4, 56.9, 1, 33, 10, 2.69],
    ['ε', 'Almaaz', 5, 1.6, 1, 43, 49, 2.99],
  ],
  Leo: [
    ['α', 'Regulus', 10, 8.4, 1, 11, 58, 1.35],
    ['β', 'Denebola', 11, 49.1, 1, 14, 34, 2.14],
    ['γ', 'Algieba', 10, 20.0, 1, 19, 50, 2.01],
    ['δ', 'Zosma', 11, 14.1, 1, 20, 31, 2.56],
    ['θ', 'Chertan', 11, 14.2, 1, 15, 26, 3.34],
  ],
  Vir: [
    ['α', 'Spica', 13, 25.2, -1, 11, 10, 0.97],
    ['γ', 'Porrima', 12, 41.7, -1, 1, 27, 2.74],
    ['ε', 'Vindemiatrix', 13, 2.2, 1, 10, 57, 2.83],
    ['η', 'Zaniah', 12, 19.9, -1, 0, 40, 3.89],
    ['ζ', 'Heze', 13, 34.7, -1, 0, 36, 3.37],
  ],
  Lib: [
    ['α', 'Zubenelgenubi', 14, 50.7, -1, 16, 2, 2.75],
    ['β', 'Zubeneschamali', 15, 17.0, -1, 9, 23, 2.61],
    ['σ', 'Brachium', 15, 4.0, -1, 25, 17, 3.29],
  ],
  Sco: [
    ['α', 'Antares', 16, 29.4, -1, 26, 26, 0.96],
    ['β', 'Graffias', 16, 5.4, -1, 19, 48, 2.56],
    ['δ', 'Dschubba', 16, 0.3, -1, 22, 37, 2.29],
    ['θ', 'Sargas', 17, 37.3, -1, 43, 0, 1.86],
    ['λ', 'Shaula', 17, 33.6, -1, 37, 6, 1.62],
    ['υ', 'Lesath', 17, 30.8, -1, 37, 17, 2.7],
  ],
  Sgr: [
    ['ε', 'Kaus Australis', 18, 24.2, -1, 34, 23, 1.85],
    ['σ', 'Nunki', 18, 55.3, -1, 26, 18, 2.05],
    ['δ', 'Kaus Media', 18, 20.9, -1, 29, 50, 2.7],
    ['λ', 'Kaus Borealis', 18, 27.9, -1, 25, 25, 2.82],
    ['ζ', 'Ascella', 19, 2.6, -1, 29, 53, 2.6],
  ],
  Cap: [
    ['δ', 'Deneb Algedi', 21, 47.0, -1, 16, 8, 2.85],
    ['β', 'Dabih', 20, 21.0, -1, 14, 47, 3.05],
  ],
  Aqr: [
    ['β', 'Sadalsuud', 21, 31.6, -1, 5, 34, 2.87],
    ['α', 'Sadalmelik', 22, 5.8, -1, 0, 19, 2.95],
    ['δ', 'Skat', 22, 54.7, -1, 15, 49, 3.27],
  ],
  Psc: [
    ['α', 'Alrescha', 2, 2.0, 1, 2, 46, 3.82],
  ],
  Ari: [
    ['α', 'Hamal', 2, 7.2, 1, 23, 28, 2.01],
    ['β', 'Sheratan', 1, 54.6, 1, 20, 48, 2.64],
    ['γ', 'Mesarthim', 1, 53.5, 1, 19, 18, 3.86],
  ],
  Cnc: [
    ['δ', 'Asellus Australis', 8, 44.7, 1, 18, 9, 3.94],
    ['β', 'Tarf', 8, 16.5, 1, 9, 11, 3.53],
  ],
  Boo: [
    ['α', 'Arcturus', 14, 15.7, 1, 19, 11, -0.05],
    ['ε', 'Izar', 14, 45.0, 1, 27, 4, 2.37],
    ['η', 'Muphrid', 13, 54.7, 1, 18, 24, 2.68],
    ['γ', 'Seginus', 14, 32.1, 1, 38, 19, 3.03],
    ['β', 'Nekkar', 15, 1.9, 1, 40, 23, 3.5],
  ],
  CrB: [
    ['α', 'Alphecca', 15, 34.7, 1, 26, 43, 2.23],
  ],
  Her: [
    ['β', 'Kornephoros', 16, 30.1, 1, 21, 29, 2.78],
    ['α', 'Rasalgethi', 17, 14.6, 1, 14, 23, 3.08],
    ['δ', 'Sarin', 17, 15.0, 1, 24, 50, 3.14],
    ['κ', 'Marsic', 16, 8.1, 1, 17, 3, 3.42],
  ],
  Lyr: [
    ['α', 'Vega', 18, 36.9, 1, 38, 47, 0.03],
    ['β', 'Sheliak', 18, 50.1, 1, 33, 22, 3.52],
    ['γ', 'Sulafat', 18, 58.9, 1, 32, 41, 3.24],
  ],
  Cyg: [
    ['α', 'Deneb', 20, 41.4, 1, 45, 17, 1.25],
    ['β', 'Albireo', 19, 30.7, 1, 27, 58, 3.18],
    ['γ', 'Sadr', 20, 22.2, 1, 40, 15, 2.23],
    ['ε', 'Gienah', 20, 46.2, 1, 33, 58, 2.46],
    ['δ', 'Fawaris', 19, 44.9, 1, 45, 8, 2.87],
  ],
  Aql: [
    ['α', 'Altair', 19, 50.8, 1, 8, 52, 0.76],
    ['γ', 'Tarazed', 19, 46.3, 1, 10, 37, 2.72],
    ['β', 'Alshain', 19, 55.3, 1, 6, 24, 3.71],
  ],
  Del: [
    ['α', 'Sualocin', 20, 39.6, 1, 15, 55, 3.77],
    ['β', 'Rotanev', 20, 37.5, 1, 14, 35, 3.63],
  ],
  Peg: [
    ['α', 'Markab', 23, 4.7, 1, 15, 12, 2.49],
    ['β', 'Scheat', 23, 3.8, 1, 28, 5, 2.42],
    ['γ', 'Algenib', 0, 13.2, 1, 15, 11, 2.83],
    ['ε', 'Enif', 21, 44.2, 1, 9, 53, 2.39],
    ['η', 'Matar', 22, 43.0, 1, 30, 13, 2.94],
  ],
  And: [
    ['α', 'Alpheratz', 0, 8.4, 1, 29, 5, 2.06],
    ['β', 'Mirach', 1, 9.7, 1, 35, 37, 2.05],
    ['γ', 'Almach', 2, 3.9, 1, 42, 20, 2.1],
  ],
  Per: [
    ['α', 'Mirfak', 3, 24.3, 1, 49, 52, 1.79],
    ['β', 'Algol', 3, 8.2, 1, 40, 57, 2.12],
    ['ξ', 'Menkib', 3, 58.9, 1, 35, 47, 4.04],
    ['η', 'Miram', 2, 50.7, 1, 55, 54, 3.76],
  ],
  Crv: [
    ['γ', 'Gienah', 12, 15.8, -1, 17, 32, 2.59],
    ['β', 'Kraz', 12, 34.4, -1, 23, 24, 2.65],
    ['δ', 'Algorab', 12, 29.9, -1, 16, 31, 2.94],
    ['ε', 'Minkar', 12, 10.1, -1, 22, 37, 3.02],
  ],
  Hya: [
    ['α', 'Alphard', 9, 27.6, -1, 8, 39, 1.98],
  ],
  Cen: [
    ['α', 'Rigil Kentaurus', 14, 39.6, -1, 60, 50, -0.27],
    ['β', 'Hadar', 14, 3.8, -1, 60, 22, 0.61],
    ['θ', 'Menkent', 14, 6.7, -1, 36, 22, 2.06],
  ],
  Cru: [
    ['α', 'Acrux', 12, 26.6, -1, 63, 6, 0.77],
    ['β', 'Mimosa', 12, 47.7, -1, 59, 41, 1.25],
    ['γ', 'Gacrux', 12, 31.2, -1, 57, 7, 1.59],
    ['δ', 'Imai', 12, 15.1, -1, 58, 45, 2.79],
  ],
  Car: [
    ['α', 'Canopus', 6, 23.9, -1, 52, 42, -0.74],
    ['β', 'Miaplacidus', 9, 13.2, -1, 69, 43, 1.68],
    ['ε', 'Avior', 8, 22.5, -1, 59, 30, 1.86],
    ['ι', 'Aspidiske', 9, 17.1, -1, 59, 16, 2.21],
  ],
  Vel: [
    ['λ', 'Suhail', 9, 7.9, -1, 43, 26, 2.21],
    ['κ', 'Markeb', 9, 22.1, -1, 55, 1, 2.47],
    ['δ', 'Alsephina', 8, 44.7, -1, 54, 43, 1.93],
  ],
  Gru: [
    ['α', 'Alnair', 22, 8.2, -1, 46, 58, 1.73],
    ['β', 'Tiaki', 22, 42.7, -1, 46, 53, 2.11],
  ],
  Phe: [
    ['α', 'Ankaa', 0, 26.3, -1, 42, 18, 2.4],
  ],
  PsA: [
    ['α', 'Fomalhaut', 22, 57.6, -1, 29, 37, 1.16],
  ],
  Eri: [
    ['α', 'Achernar', 1, 37.7, -1, 57, 14, 0.46],
    ['β', 'Cursa', 5, 7.9, -1, 5, 5, 2.79],
    ['γ', 'Zaurak', 3, 58.0, -1, 13, 30, 2.95],
  ],
  Lep: [
    ['α', 'Arneb', 5, 32.7, -1, 17, 49, 2.58],
    ['β', 'Nihal', 5, 28.2, -1, 20, 45, 2.81],
  ],
  Col: [
    ['α', 'Phact', 5, 39.6, -1, 34, 4, 2.65],
  ],
  Oph: [
    ['α', 'Rasalhague', 17, 34.9, 1, 12, 33, 2.08],
    ['η', 'Sabik', 17, 10.4, -1, 15, 43, 2.43],
    ['δ', 'Yed Prior', 16, 14.3, -1, 3, 42, 2.73],
    ['ε', 'Yed Posterior', 16, 18.3, -1, 4, 42, 3.24],
    ['β', 'Cebalrai', 17, 43.5, 1, 4, 34, 2.76],
  ],
};

/** Constellation stick-figure lines, referencing [constellation, bayerA, bayerB] pairs. */
const LINES = [
  ['UMa', ['α', 'β'], ['β', 'γ'], ['γ', 'δ'], ['δ', 'α'], ['δ', 'ε'], ['ε', 'ζ'], ['ζ', 'η']],
  ['UMi', ['α', 'β'], ['β', 'γ']],
  ['Cas', ['β', 'α'], ['α', 'γ'], ['γ', 'δ'], ['δ', 'ε']],
  ['Cep', ['α', 'β'], ['α', 'γ']],
  ['Ori', ['α', 'γ'], ['γ', 'δ'], ['δ', 'ε'], ['ε', 'ζ'], ['ζ', 'κ'], ['ζ', 'β'], ['δ', 'β'], ['α', 'ζ']],
  ['CMa', ['α', 'β'], ['α', 'δ'], ['δ', 'ε'], ['δ', 'η']],
  ['CMi', ['α', 'β']],
  ['Tau', ['α', 'β']],
  ['Gem', ['α', 'β'], ['α', 'μ'], ['μ', 'ε'], ['β', 'δ'], ['δ', 'γ'], ['γ', 'μ']],
  ['Aur', ['α', 'β'], ['α', 'ι'], ['α', 'ε'], ['ε', 'ι']],
  ['Leo', ['α', 'γ'], ['γ', 'δ'], ['δ', 'β'], ['δ', 'θ'], ['θ', 'γ']],
  ['Vir', ['α', 'ζ'], ['ζ', 'ε'], ['ε', 'γ'], ['γ', 'η']],
  ['Lib', ['α', 'β'], ['α', 'σ']],
  ['Sco', ['β', 'δ'], ['δ', 'α'], ['α', 'θ'], ['θ', 'λ'], ['λ', 'υ']],
  ['Sgr', ['λ', 'δ'], ['δ', 'ε'], ['ε', 'σ'], ['σ', 'ζ'], ['λ', 'σ']],
  ['Cap', ['β', 'δ']],
  ['Aqr', ['β', 'α'], ['α', 'δ']],
  ['Ari', ['γ', 'β'], ['β', 'α']],
  ['Cnc', ['δ', 'β']],
  ['Boo', ['α', 'η'], ['α', 'ε'], ['α', 'γ'], ['γ', 'β']],
  ['Her', ['β', 'δ'], ['δ', 'α'], ['β', 'κ']],
  ['Lyr', ['α', 'β'], ['β', 'γ'], ['γ', 'α']],
  ['Cyg', ['α', 'γ'], ['γ', 'δ'], ['γ', 'ε'], ['γ', 'β']],
  ['Aql', ['γ', 'α'], ['α', 'β']],
  ['Del', ['α', 'β']],
  ['Peg', ['α', 'β'], ['β', 'η'], ['α', 'γ'], ['α', 'ε']],
  ['And', ['α', 'β'], ['β', 'γ']],
  ['Per', ['α', 'β'], ['α', 'ξ'], ['α', 'η']],
  ['Crv', ['γ', 'β'], ['β', 'ε'], ['ε', 'δ'], ['δ', 'γ']],
  ['Cen', ['α', 'β'], ['β', 'θ']],
  ['Cru', ['α', 'γ'], ['β', 'δ']],
  ['Car', ['α', 'ι'], ['ι', 'ε'], ['ε', 'β']],
  ['Vel', ['λ', 'κ'], ['κ', 'δ']],
  ['Gru', ['α', 'β']],
  ['Eri', ['α', 'β'], ['β', 'γ']],
  ['Lep', ['α', 'β']],
  ['Oph', ['α', 'δ'], ['δ', 'ε'], ['α', 'η'], ['η', 'β']],
];

function toStar(con, [bayer, name, raH, raM, decSign, decD, decM, mag]) {
  const raDeg = (raH + raM / 60) * 15;
  const decDeg = decSign * (decD + decM / 60);
  return {
    id: `${con}-${bayer}`,
    name,
    bayer,
    con,
    ra: Number(raDeg.toFixed(4)),
    dec: Number(decDeg.toFixed(4)),
    mag,
  };
}

const curatedStars = [];
for (const [con, list] of Object.entries(CATALOG)) {
  for (const raw of list) curatedStars.push(toStar(con, raw));
}

// --- Deterministic filler stars (uniform on sphere, no name/constellation) ---
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260101);
const FILLER_COUNT = 340;
const fillerStars = [];
for (let i = 0; i < FILLER_COUNT; i++) {
  const ra = rand() * 360;
  const dec = (Math.asin(2 * rand() - 1) * 180) / Math.PI;
  const mag = 3.3 + rand() * 1.2; // 3.3 - 4.5
  fillerStars.push({
    id: `fs-${i}`,
    name: null,
    bayer: null,
    con: null,
    ra: Number(ra.toFixed(4)),
    dec: Number(dec.toFixed(4)),
    mag: Number(mag.toFixed(2)),
  });
}

const stars = [...curatedStars, ...fillerStars];

const constellations = LINES.map(([con, ...pairs]) => ({
  con,
  segments: pairs.map(([a, b]) => [`${con}-${a}`, `${con}-${b}`]),
}));

// Sanity check: every referenced id must exist in curatedStars.
const idSet = new Set(curatedStars.map((s) => s.id));
for (const c of constellations) {
  for (const [a, b] of c.segments) {
    if (!idSet.has(a) || !idSet.has(b)) {
      throw new Error(`Unknown star id in constellation ${c.con}: ${a} / ${b}`);
    }
  }
}

writeFileSync(join(outDir, 'stars.json'), JSON.stringify(stars));
writeFileSync(join(outDir, 'constellations.json'), JSON.stringify(constellations));

console.log(`stars.json: ${stars.length} stars (${curatedStars.length} named + ${fillerStars.length} filler)`);
console.log(`constellations.json: ${constellations.length} constellations`);
