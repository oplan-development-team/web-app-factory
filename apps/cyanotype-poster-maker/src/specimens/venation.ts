/**
 * 葉脈標本（インドボダイジュ）— 網状脈。
 *
 * 葉肉を落として脈だけを残した「葉脈標本」を写した図案。フォトグラムでは
 * 脈が厚いぶん光を強く遮って白く残り、脈と脈のあいだの薄い葉肉は光を透かす。
 * つまり階調そのものが脈の構造図になる。この標本だけは葉脈が主役なので、
 * 三次脈（網目）まで描く。
 *
 * 葉身の輪郭と脈の到達点は、同じ `bladeProfile` から導く。別々の式で出すと
 * 脈が葉の外へ突き抜ける（実際に一度そうなった）。
 */


import { jitter, randFloat, randInt, type Rng } from '../core/random';
import type { Specimen } from './types';
import { TONE, type Point, insetArea, paintGround, paintOrgan, strokeOrgan } from './shared';

/**
 * 基部(t=0)から先端(t=1)までの葉身の半幅比（0..1）。
 * インドボダイジュは基部がハート型に張り出し、先端が尾状に長く伸びる。
 */
export function bladeProfile(t: number): number {
  if (t <= 0) return 0.16;
  if (t < 0.22) return 0.42 + 0.58 * Math.sin((t / 0.22) * Math.PI * 0.5);
  if (t < 0.72) {
    const u = (t - 0.22) / 0.5;
    return 1 - 0.62 * u * u;
  }
  const u = Math.min(1, (t - 0.72) / 0.28);
  return 0.38 * (1 - u) ** 1.6;
}

export const VENATION: Specimen = {
  id: 'venation',
  plateNo: 'PL. III',
  label: '葉脈標本（インドボダイジュ）',
  scientificName: 'Ficus religiosa',
  commonName: 'インドボダイジュ',
  locality: 'インド ビハール州 ブッダガヤ',
  note: '葉肉を落として脈だけを残した標本。階調がそのまま構造図になる',

  draw(ctx, width, height, rng: Rng) {
    const seed = Math.floor(rng() * 1e9);
    paintGround(ctx, width, height, seed);

    const area = insetArea(width, height, 0.1);
    const scale = Math.min(area.w, area.h) / 100;

    const axisX = area.x + area.w * 0.5 + jitter(rng, area.w * 0.02);
    const bladeBaseY = area.y + area.h * 0.82;
    const apexY = area.y + area.h * 0.03;
    const bladeHeight = bladeBaseY - apexY;
    const halfWidth = area.w * randFloat(rng, 0.32, 0.38);
    const lean = jitter(rng, area.w * 0.03);

    // 葉身上の座標。t は基部 0 〜 先端 1
    const axisAt = (t: number): Point => ({ x: axisX + lean * t * t, y: bladeBaseY - bladeHeight * t });
    const edgeAt = (t: number, side: number, inset = 1): Point => {
      const centre = axisAt(t);
      return { x: centre.x + halfWidth * bladeProfile(t) * inset * side, y: centre.y };
    };

    // 葉柄
    strokeOrgan(
      ctx,
      (c) => {
        c.moveTo(axisX, area.y + area.h * 0.995);
        c.quadraticCurveTo(axisX + area.w * 0.035, bladeBaseY + bladeHeight * 0.08, axisX, bladeBaseY);
      },
      TONE.core,
      scale * 2.2,
      scale * 0.8,
    );

    // 葉身。縁のゆらぎは輪郭にだけ効かせ、脈の到達点には影響させない
    const wobblePhase = randFloat(rng, 0, Math.PI * 2);
    const wobbleFreq = randInt(rng, 6, 11);
    const wobbleOf = (t: number): number => 1 + Math.sin(wobblePhase + t * Math.PI * wobbleFreq) * 0.035;

    paintOrgan(
      ctx,
      (c) => {
        const steps = 56;
        const first = edgeAt(0, 1, wobbleOf(0));
        c.moveTo(first.x, first.y);
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const p = edgeAt(t, 1, wobbleOf(t));
          c.lineTo(p.x, p.y);
        }
        for (let i = steps; i >= 0; i--) {
          const t = i / steps;
          const p = edgeAt(t, -1, wobbleOf(t));
          c.lineTo(p.x, p.y);
        }
        c.closePath();
      },
      TONE.lamina,
      scale * 1.6,
    );

    // 主脈
    strokeOrgan(
      ctx,
      (c) => {
        const start = axisAt(0);
        c.moveTo(start.x, start.y);
        for (let i = 1; i <= 24; i++) {
          const p = axisAt(i / 24);
          c.lineTo(p.x, p.y);
        }
      },
      TONE.core,
      scale * 1.5,
      scale * 0.6,
    );

    // 二次脈: 主脈から縁へ弧を描いて上がる。終点は必ず葉身の内側
    const pairs = randInt(rng, 7, 9);
    const secondaries: Array<{ from: Point; to: Point; control: Point }> = [];

    for (let i = 0; i < pairs; i++) {
      const tFrom = 0.05 + (i / (pairs - 1)) * 0.72;
      const rise = randFloat(rng, 0.07, 0.11);
      const tTo = Math.min(0.97, tFrom + rise);
      const from = axisAt(tFrom);

      for (const side of [1, -1]) {
        const to = edgeAt(tTo, side, randFloat(rng, 0.82, 0.9));
        const mid = edgeAt((tFrom + tTo) / 2, side, randFloat(rng, 0.4, 0.5));
        const control: Point = { x: mid.x, y: mid.y + bladeHeight * 0.012 };
        secondaries.push({ from, to, control });
        strokeOrgan(
          ctx,
          (c) => {
            c.moveTo(from.x, from.y);
            c.quadraticCurveTo(control.x, control.y, to.x, to.y);
          },
          TONE.rib,
          scale * 0.8,
          scale * 0.35,
        );
      }
    }

    // 三次脈: 隣り合う二次脈のあいだを繋ぐ網目。この標本の主役
    for (let i = 0; i < secondaries.length - 2; i++) {
      const a = secondaries[i];
      const b = secondaries[i + 2];
      if (!a || !b) continue;
      const rungs = randInt(rng, 2, 4);
      for (let k = 1; k <= rungs; k++) {
        const t = (k / (rungs + 1)) * randFloat(rng, 0.88, 1.12);
        const from = onQuad(a, Math.min(0.98, t));
        const to = onQuad(b, Math.min(0.95, t * randFloat(rng, 0.6, 0.85)));
        const control: Point = {
          x: (from.x + to.x) / 2 + jitter(rng, area.w * 0.018),
          y: (from.y + to.y) / 2 + jitter(rng, area.h * 0.01),
        };
        strokeOrgan(
          ctx,
          (c) => {
            c.moveTo(from.x, from.y);
            c.quadraticCurveTo(control.x, control.y, to.x, to.y);
          },
          TONE.blade,
          scale * 0.4,
          scale * 0.18,
        );
      }
    }
  },
};

/** 2次ベジエ上の点。三次脈の端点を、二次脈の実際の曲線上に置くために使う。 */
function onQuad(curve: { from: Point; to: Point; control: Point }, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * curve.from.x + 2 * u * t * curve.control.x + t * t * curve.to.x,
    y: u * u * curve.from.y + 2 * u * t * curve.control.y + t * t * curve.to.y,
  };
}
