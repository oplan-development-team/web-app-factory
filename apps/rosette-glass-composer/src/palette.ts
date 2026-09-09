import type { GemColor } from './types.ts';

export const GEM_PALETTE: GemColor[] = [
  { id: 'ruby', name: 'ルビー', hex: '#9e1b32' },
  { id: 'sapphire', name: 'サファイア', hex: '#1d3f7a' },
  { id: 'emerald', name: 'エメラルド', hex: '#0f6b45' },
  { id: 'amethyst', name: 'アメジスト', hex: '#5b2a86' },
  { id: 'amber', name: '琥珀', hex: '#d68a1c' },
  { id: 'forest', name: '深緑', hex: '#0c4a38' },
  { id: 'cobalt', name: 'コバルト', hex: '#215fa8' },
  { id: 'milk', name: '乳白', hex: '#e9e2cd' },
  { id: 'garnet', name: 'ガーネット', hex: '#6b1f2a' },
  { id: 'topaz', name: 'トパーズ', hex: '#dea23a' },
  { id: 'rosequartz', name: 'ローズクォーツ', hex: '#c56a8a' },
  { id: 'onyx', name: 'オニキス', hex: '#241f2e' },
  { id: 'peridot', name: 'ペリドット', hex: '#8caa2b' },
  { id: 'aquamarine', name: 'アクアマリン', hex: '#3fa79a' },
];

/**
 * Very small, dependency-free k-means-ish color quantizer.
 * Samples pixels from the image, runs a handful of Lloyd iterations in RGB
 * space and returns the resulting cluster centroids as hex colors, sorted
 * roughly by cluster population (most dominant first).
 *
 * The source image itself is never retained -- only the resulting colors
 * are kept, per the "photo is for palette extraction only" requirement.
 */
export function extractDominantColors(imageData: ImageData, k = 7): string[] {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  const sampleStep = Math.max(1, Math.floor(Math.sqrt(totalPixels / 4000)));

  const samples: Array<[number, number, number]> = [];
  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const idx = (y * width + x) * 4;
      const a = data[idx + 3] ?? 0;
      if (a < 16) continue; // skip near-transparent pixels
      const r = data[idx] ?? 0;
      const g = data[idx + 1] ?? 0;
      const b = data[idx + 2] ?? 0;
      samples.push([r, g, b]);
    }
  }
  if (samples.length === 0) return [];

  const clusterCount = Math.min(k, samples.length);
  // Seed centroids by picking evenly spaced samples (deterministic, no RNG).
  const centroids: Array<[number, number, number]> = [];
  for (let i = 0; i < clusterCount; i++) {
    const s = samples[Math.floor((i / clusterCount) * samples.length)]!;
    centroids.push([...s]);
  }

  const assignments = new Int32Array(samples.length);
  const ITERATIONS = 8;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let i = 0; i < samples.length; i++) {
      const [r, g, b] = samples[i]!;
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const [cr, cg, cb] = centroids[c]!;
        const dr = r - cr;
        const dg = g - cg;
        const db = b - cb;
        const d = dr * dr + dg * dg + db * db;
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      assignments[i] = best;
    }

    const sums = centroids.map(() => [0, 0, 0, 0] as [number, number, number, number]);
    for (let i = 0; i < samples.length; i++) {
      const c = assignments[i]!;
      const [r, g, b] = samples[i]!;
      const sum = sums[c]!;
      sum[0] += r;
      sum[1] += g;
      sum[2] += b;
      sum[3] += 1;
    }
    for (let c = 0; c < centroids.length; c++) {
      const sum = sums[c]!;
      if (sum[3] > 0) {
        centroids[c] = [sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3]];
      }
    }
  }

  const populations = new Array(centroids.length).fill(0);
  for (let i = 0; i < assignments.length; i++) populations[assignments[i]!]++;

  return centroids
    .map((c, i) => ({ hex: rgbToHex(c[0], c[1], c[2]), pop: populations[i] }))
    .sort((a, b) => b.pop - a.pop)
    .map((c) => c.hex);
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
