// 濾紙シミュレーション: 正規化座標(濾紙半径=1)の格子に、顔料成分ごとの光学濃度(OD)を保持する。
// 各滴の水の前線は Washburn 的に sqrt(t) で広がり、成分は固有の Rf で前線の内側に帯として沈着する。
// 物理的厳密さより「説得力のある近似」を優先し、格子は毎ステップ解析的に再構成する（時間加速=時間の進み幅を増やすだけ）。

export const N = 224;
export const T_FULL = 24; // 1滴が縁(0.98)に達するまでのシミュレーション秒
export const EDGE = 0.98;
export const MAX_DROPS = 10;

export type RGB = [number, number, number];

export interface Comp {
  name: string;
  color: RGB;
  rf: number;
  spread: number;
  frac: number;
  od: RGB;
}
export interface InkDef {
  id: string;
  label: string;
  en: string;
  comps: Comp[];
}
export interface Drop {
  x: number;
  y: number;
  t0: number;
  r0: number;
  amp: number;
  volume: number;
  inkEn: string;
  comps: Comp[];
}
export interface Band {
  rNorm: number;
  rf: number;
  rgb: RGB;
}

export const hex2rgb = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
export const rgb2hex = (c: RGB): string =>
  '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

const odOf = (c: RGB): RGB =>
  [0, 1, 2].map((i) => -Math.log(Math.max(c[i] / 255, 0.05))) as RGB;

export const mkComp = (name: string, hex: string, rf: number, spread: number, frac: number): Comp => {
  const color = hex2rgb(hex);
  return { name, color, rf, spread, frac, od: odOf(color) };
};

export const PRESETS: InkDef[] = [
  {
    id: 'black', label: '黒ペン', en: 'Black felt-tip',
    comps: [
      mkComp('Yellow', '#F2C200', 0.93, 0.9, 0.7),
      mkComp('Rose', '#D0284F', 0.74, 1.0, 0.7),
      mkComp('Azure', '#1E86C8', 0.55, 1.0, 0.75),
      mkComp('Violet', '#5B3A9E', 0.36, 1.1, 0.75),
      mkComp('Indigo', '#26305E', 0.17, 1.2, 0.7),
    ],
  },
  {
    id: 'green', label: '緑ペン', en: 'Green marker',
    comps: [
      mkComp('Yellow', '#F0C800', 0.92, 0.9, 0.8),
      mkComp('Cyan', '#10A8BA', 0.62, 1.0, 0.8),
      mkComp('Viridian', '#1F8A5A', 0.36, 1.1, 0.7),
    ],
  },
  {
    id: 'purple', label: '紫ペン', en: 'Purple marker',
    comps: [
      mkComp('Magenta', '#C42A8C', 0.8, 1.0, 0.85),
      mkComp('Blue', '#3B4FC0', 0.52, 1.0, 0.8),
      mkComp('Violet', '#6A3A9A', 0.28, 1.2, 0.7),
    ],
  },
  {
    id: 'brown', label: '茶ペン', en: 'Brown marker',
    comps: [
      mkComp('Yellow', '#E8B020', 0.9, 0.9, 0.8),
      mkComp('Vermilion', '#C8402A', 0.64, 1.0, 0.8),
      mkComp('Ultramarine', '#2C5AA0', 0.38, 1.1, 0.75),
    ],
  },
  {
    id: 'orange', label: '橙ペン', en: 'Orange marker',
    comps: [
      mkComp('Yellow', '#F5C400', 0.94, 0.9, 0.85),
      mkComp('Orange', '#F08000', 0.7, 1.0, 0.85),
      mkComp('Red', '#D83A2A', 0.44, 1.1, 0.7),
    ],
  },
  {
    id: 'turquoise', label: 'ターコイズ', en: 'Turquoise marker',
    comps: [
      mkComp('Lime', '#B8D21C', 0.88, 0.9, 0.8),
      mkComp('Cyan', '#00A6B4', 0.6, 1.0, 0.9),
      mkComp('Cobalt', '#2060B0', 0.34, 1.1, 0.75),
    ],
  },
];

export function blendInk(c: number, m: number, y: number): InkDef {
  const f = (v: number) => Math.max(0.04, v / 100);
  return {
    id: 'blend', label: '自作', en: `Custom CMY C${c} M${m} Y${y}`,
    comps: [
      mkComp('Cyan', '#0096D6', 0.5, 1.0, f(c)),
      mkComp('Magenta', '#D61E78', 0.74, 1.0, f(m)),
      mkComp('Yellow', '#F5D000', 0.92, 0.9, f(y)),
    ],
  };
}

/** 成分をそのまま重ねたときの見かけの色（チップ見本用） */
export function inkSwatch(ink: InkDef): RGB {
  const od = [0, 0, 0];
  for (const c of ink.comps) for (let i = 0; i < 3; i++) od[i] += c.od[i] * c.frac * 0.55;
  return od.map((v) => 255 * Math.exp(-v)) as RGB;
}

export const radiusOf = (volume: number) => 0.03 + 0.016 * volume;

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export class Sim {
  od = [new Float32Array(N * N), new Float32Array(N * N), new Float32Array(N * N)];
  wet = new Float32Array(N * N);
  rim = new Float32Array(N * N);
  drops: Drop[] = [];
  t = 0;
  reached = false; // 前線が縁に到達
  frozen = false; // 乾燥などで停止

  reset() {
    this.drops = [];
    this.t = 0;
    this.reached = false;
    this.frozen = false;
    this.od.forEach((a) => a.fill(0));
    this.wet.fill(0);
    this.rim.fill(0);
  }

  addDrop(x: number, y: number, volume: number, ink: InkDef) {
    this.drops.push({
      x, y, t0: this.t, r0: radiusOf(volume), amp: 1.0 + 0.35 * volume, volume,
      inkEn: ink.en, comps: ink.comps.map((c) => ({ ...c })),
    });
    this.recompute();
  }

  ageOf(d: Drop) { return Math.min(T_FULL, Math.max(0, this.t - d.t0)); }
  frontOf(d: Drop) { return d.r0 + (EDGE - d.r0) * Math.sqrt(this.ageOf(d) / T_FULL); }
  /** 最古の滴の前線が縁までどれだけ進んだか 0..1 */
  progress() {
    if (!this.drops.length) return 0;
    return Math.sqrt(this.ageOf(this.drops[0]) / T_FULL);
  }

  step(dt: number) {
    if (this.frozen || !this.drops.length) return;
    this.t += dt;
    const first = this.drops[0];
    if (this.t - first.t0 >= T_FULL) {
      this.t = first.t0 + T_FULL;
      this.reached = true;
      this.frozen = true;
    }
    this.recompute();
  }

  freeze() { this.frozen = true; }

  recompute() {
    const [odR, odG, odB] = this.od;
    odR.fill(0); odG.fill(0); odB.fill(0);
    this.wet.fill(0);
    this.rim.fill(0);
    const h = 2 / N;
    const toCell = (v: number) => Math.floor((v + 1) / h);
    for (const d of this.drops) {
      const front = this.frontOf(d);
      // 水の湿り
      {
        const lim = front + 0.03;
        const x0 = Math.max(0, toCell(d.x - lim)), x1 = Math.min(N - 1, toCell(d.x + lim));
        const y0 = Math.max(0, toCell(d.y - lim)), y1 = Math.min(N - 1, toCell(d.y + lim));
        for (let iy = y0; iy <= y1; iy++) {
          const dy = -1 + (iy + 0.5) * h - d.y;
          for (let ix = x0; ix <= x1; ix++) {
            const dx = -1 + (ix + 0.5) * h - d.x;
            const r = Math.sqrt(dx * dx + dy * dy);
            if (r > lim) continue;
            const i = iy * N + ix;
            const w = smooth((front + 0.012 - r) / 0.024);
            if (w > this.wet[i]) this.wet[i] = w;
            const q = (r - front) / 0.014;
            const rm = Math.exp(-q * q);
            if (rm > this.rim[i]) this.rim[i] = rm;
          }
        }
      }
      // 顔料の帯
      for (const c of d.comps) {
        const rc = d.r0 + (front - d.r0) * c.rf;
        const w = 0.016 + 0.045 * (rc - d.r0) * c.spread;
        const peak = d.amp * c.frac * Math.pow(0.016 / w, 0.7);
        const lo = rc - 9 * w, hi = rc + 4 * w;
        const x0 = Math.max(0, toCell(d.x - hi)), x1 = Math.min(N - 1, toCell(d.x + hi));
        const y0 = Math.max(0, toCell(d.y - hi)), y1 = Math.min(N - 1, toCell(d.y + hi));
        const inv2w2 = 1 / (2 * w * w), inv4w = 1 / (4 * w);
        const core = 0.3 * (1 - c.rf);
        const [ar, ag, ab] = c.od;
        for (let iy = y0; iy <= y1; iy++) {
          const py = -1 + (iy + 0.5) * h;
          const dy = py - d.y;
          for (let ix = x0; ix <= x1; ix++) {
            const px = -1 + (ix + 0.5) * h;
            const dx = px - d.x;
            const r = Math.sqrt(dx * dx + dy * dy);
            if (px * px + py * py > 1) continue;
            let f = 0;
            if (r >= lo && r <= hi) {
              const x = r - rc;
              f = x >= 0 ? Math.exp(-x * x * inv2w2) : 0.6 * Math.exp(-x * x * inv2w2) + 0.4 * Math.exp(x * inv4w);
            }
            if (r < d.r0 + 0.045) f += core * smooth((d.r0 + 0.015 - r) / 0.03 + 0.5);
            if (f <= 0.002) continue;
            const wetMask = smooth((front + 0.012 - r) / 0.02);
            const conc = peak * f * wetMask;
            const i = iy * N + ix;
            odR[i] += conc * ar; odG[i] += conc * ag; odB[i] += conc * ab;
          }
        }
      }
    }
  }
}

/** 乾燥後の半径方向プロファイル解析（最初の滴を中心に、最大5本の帯を検出） */
export function analyze(sim: Sim): Band[] {
  try {
    const d = sim.drops[0];
    if (!d) return [];
    const front = sim.frontOf(d);
    const start = d.r0 + 0.012;
    if (front - start < 0.08) return [];
    const S = 180, A = 56;
    const p = new Float32Array(S);
    const rs = new Float32Array(S);
    const ch = [new Float32Array(S), new Float32Array(S), new Float32Array(S)];
    for (let i = 0; i < S; i++) {
      const rr = start + ((front - start) * 1.04 * i) / (S - 1);
      rs[i] = rr;
      let n = 0;
      for (let a = 0; a < A; a++) {
        const th = (a / A) * Math.PI * 2;
        const px = d.x + rr * Math.cos(th), py = d.y + rr * Math.sin(th);
        if (px * px + py * py > 0.92) continue;
        const ix = Math.floor((px + 1) / (2 / N)), iy = Math.floor((py + 1) / (2 / N));
        if (ix < 0 || iy < 0 || ix >= N || iy >= N) continue;
        const k = iy * N + ix;
        for (let c = 0; c < 3; c++) ch[c][i] += sim.od[c][k];
        n++;
      }
      if (n < 6) { p[i] = 0; continue; }
      for (let c = 0; c < 3; c++) ch[c][i] /= n;
      p[i] = ch[0][i] + ch[1][i] + ch[2][i];
    }
    const sm = new Float32Array(S);
    for (let i = 0; i < S; i++) sm[i] = ((p[Math.max(0, i - 1)] + p[i] * 2 + p[Math.min(S - 1, i + 1)]) / 4);
    let maxp = 0;
    for (let i = 0; i < S; i++) maxp = Math.max(maxp, sm[i]);
    if (maxp <= 0.05) return [];
    const cand: { i: number; v: number }[] = [];
    for (let i = 3; i < S - 3; i++) {
      let isMax = true;
      for (let k = 1; k <= 4 && isMax; k++) {
        if (i - k >= 0 && sm[i - k] > sm[i]) isMax = false;
        if (i + k < S && sm[i + k] >= sm[i] + 1e-6) isMax = false;
      }
      if (!isMax || sm[i] < 0.1 * maxp) continue;
      let lmin = sm[i], rmin = sm[i];
      for (let k = 1; k <= 14; k++) {
        if (i - k >= 0) lmin = Math.min(lmin, sm[i - k]);
        if (i + k < S) rmin = Math.min(rmin, sm[i + k]);
      }
      if (sm[i] - Math.max(lmin, rmin) < 0.04 * maxp) continue;
      cand.push({ i, v: sm[i] });
    }
    cand.sort((a, b) => b.v - a.v);
    const picked: { i: number; v: number }[] = [];
    for (const c of cand) {
      if (picked.length >= 5) break;
      if (picked.some((q) => Math.abs(q.i - c.i) < 6)) continue;
      picked.push(c);
    }
    return picked
      .map(({ i }) => {
        const rgb = [0, 1, 2].map((c) => 255 * Math.exp(-ch[c][i] * 0.95)) as RGB;
        const rf = Math.max(0, Math.min(1, (rs[i] - d.r0) / (front - d.r0)));
        return { rNorm: rs[i], rf, rgb };
      })
      .sort((a, b) => b.rf - a.rf);
  } catch {
    return [];
  }
}
