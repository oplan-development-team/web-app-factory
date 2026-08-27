/**
 * エノコログサ — 細く弧を描く稈と、剛毛を持つ穂。
 *
 * 群として立てると、細い線ばかりの図になる。フォトグラムでは細い器官ほど
 * 接触が甘くて縁がぼやけるので、稈は半影を強めに、穂の剛毛は細く鋭く残す。
 */

import { jitter, randFloat, randInt, type Rng } from '../core/random';
import type { Specimen } from './types';
import {
  TONE,
  type Point,
  insetArea,
  leafOutline,
  lerpPoint,
  paintGround,
  paintOrgan,
  ribbonOutline,
  strokeOrgan,
  wobbleSpine,
} from './shared';

export const GRASS: Specimen = {
  id: 'grass',
  plateNo: 'PL. V',
  label: 'エノコログサ',
  scientificName: 'Setaria viridis',
  commonName: 'エノコログサ',
  locality: '東京都 多摩川河川敷',
  note: '細い稈と剛毛の穂。線ばかりの図をどう成立させるかの一枚',

  draw(ctx, width, height, rng: Rng) {
    const seed = Math.floor(rng() * 1e9);
    paintGround(ctx, width, height, seed);

    const area = insetArea(width, height, 0.09);
    const scale = Math.min(area.w, area.h) / 100;
    const culms = randInt(rng, 3, 5);

    for (let i = 0; i < culms; i++) {
      const lateral = culms === 1 ? 0 : (i / (culms - 1) - 0.5) * 2;
      const base: Point = {
        x: area.x + area.w * (0.5 + lateral * randFloat(rng, 0.08, 0.16)),
        y: area.y + area.h * 0.995,
      };
      const headHeight = area.h * randFloat(rng, 0.6, 0.86);
      const lean = area.w * lateral * randFloat(rng, 0.1, 0.2);
      const top: Point = { x: base.x + lean, y: base.y - headHeight };
      // 穂の重みで先が垂れる
      const bend = area.w * randFloat(rng, 0.05, 0.13) * (lateral >= 0 ? 1 : -1);
      const culm = wobbleSpine(base, top, bend, 26, rng, area.w * 0.012);

      paintOrgan(
        ctx,
        (c) => ribbonOutline(c, culm, (t) => scale * (1.3 - t * 0.7)),
        TONE.rib,
        scale * 0.7,
      );

      // 稈から出る細長い葉
      const blades = randInt(rng, 1, 3);
      for (let b = 0; b < blades; b++) {
        const t = randFloat(rng, 0.15, 0.6);
        const anchor = culm[Math.round(t * (culm.length - 1))] as Point;
        const side = b % 2 === 0 ? 1 : -1;
        const length = area.h * randFloat(rng, 0.16, 0.3);
        const tip: Point = {
          x: anchor.x + length * randFloat(rng, 0.45, 0.8) * side,
          y: anchor.y - length * randFloat(rng, 0.5, 0.85),
        };
        paintOrgan(ctx, (c) => leafOutline(c, anchor, tip, length * 0.05, 0.3), TONE.lamina, scale * 0.9);
      }

      // 穂（円柱状の花序）
      const spikeLength = headHeight * randFloat(rng, 0.16, 0.24);
      const spikeWidth = area.w * randFloat(rng, 0.026, 0.04);
      const droop = area.w * randFloat(rng, 0.03, 0.08) * (lateral >= 0 ? 1 : -1);
      const spikeTip: Point = { x: top.x + droop, y: top.y - spikeLength };

      paintOrgan(ctx, (c) => leafOutline(c, top, spikeTip, spikeWidth, 0.45), TONE.core, scale * 0.8);

      // 剛毛（穂から放射状に伸びる細い毛）
      const bristles = randInt(rng, 26, 40);
      for (let n = 0; n < bristles; n++) {
        const t = n / bristles;
        const anchor = lerpPoint(top, spikeTip, t);
        const side = n % 2 === 0 ? 1 : -1;
        const angle = randFloat(rng, 0.5, 1.15) * side;
        const len = spikeWidth * randFloat(rng, 2.4, 4.6);
        strokeOrgan(
          ctx,
          (c) => {
            c.moveTo(anchor.x, anchor.y);
            c.lineTo(
              anchor.x + Math.sin(angle) * len + jitter(rng, len * 0.1),
              anchor.y - Math.cos(angle) * len * 0.75,
            );
          },
          TONE.blade,
          Math.max(0.6, scale * 0.24),
          scale * 0.16,
        );
      }
    }
  },
};
