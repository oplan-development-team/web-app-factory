/**
 * シダ（ワラビ）— 羽状複葉。
 *
 * 湾曲する中軸に羽片が交互に並び、各羽片はさらに裂片へ割れる。
 * サイアノタイプのフォトグラムで最も繰り返し撮られてきた被写体で、
 * 「細い部分が光を透かし、重なった部分だけが白く残る」階調が要になる。
 */

import type { Ctx2D } from '../core/ctx2d';
import { randFloat, randInt, type Rng } from '../core/random';
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

function drawPinna(ctx: Ctx2D, base: Point, tip: Point, halfWidth: number, lobes: number, scale: number): void {
  // 羽片の本体
  paintOrgan(ctx, (c) => leafOutline(c, base, tip, halfWidth, 0.35), TONE.lamina, scale * 0.9);

  // 裂片: 中軸から斜め前方へ出る小さな葉片。重なった箇所が明るくなる
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  for (let i = 0; i < lobes; i++) {
    const t = 0.12 + (i / lobes) * 0.78;
    const anchor = lerpPoint(base, tip, t);
    const reach = halfWidth * (1.05 - t * 0.55);
    const forward = 0.18;
    for (const side of [1, -1]) {
      const lobeTip: Point = {
        x: anchor.x + nx * reach * side + (dx / len) * reach * forward,
        y: anchor.y + ny * reach * side + (dy / len) * reach * forward,
      };
      paintOrgan(ctx, (c) => leafOutline(c, anchor, lobeTip, reach * 0.34, 0.45), TONE.blade, scale * 0.7);
    }
  }

  // 羽軸
  strokeOrgan(
    ctx,
    (c) => {
      c.moveTo(base.x, base.y);
      c.lineTo(tip.x, tip.y);
    },
    TONE.rib,
    Math.max(1, scale * 0.9),
    scale * 0.5,
  );
}

export const FERN: Specimen = {
  id: 'fern',
  plateNo: 'PL. I',
  label: 'シダ（ワラビ）',
  scientificName: 'Pteridium aquilinum',
  commonName: 'ワラビ',
  locality: '長野県 霧ヶ峰',
  note: '羽状複葉。細部が光を透かす階調がそのまま意匠になる',

  draw(ctx, width, height, rng: Rng) {
    const seed = Math.floor(rng() * 1e9);
    paintGround(ctx, width, height, seed);

    const area = insetArea(width, height, 0.09);
    const scale = Math.min(area.w, area.h) / 100;

    const base: Point = { x: area.x + area.w * randFloat(rng, 0.44, 0.56), y: area.y + area.h * 0.99 };
    const tip: Point = { x: area.x + area.w * randFloat(rng, 0.42, 0.58), y: area.y + area.h * 0.03 };
    const bend = area.w * randFloat(rng, -0.1, 0.1);
    const spine = wobbleSpine(base, tip, bend, 40, rng, area.w * 0.03);

    // 中軸（基部が太く先端へ細る）
    paintOrgan(
      ctx,
      (c) => ribbonOutline(c, spine, (t) => scale * (2.2 - t * 1.7)),
      TONE.rib,
      scale * 0.8,
    );

    const pairs = randInt(rng, 11, 15);
    const spread = randFloat(rng, 0.42, 0.52);

    for (let i = 0; i < pairs; i++) {
      const t = 0.06 + (i / (pairs - 1)) * 0.9;
      const index = Math.min(spine.length - 1, Math.round(t * (spine.length - 1)));
      // 基部側が長く、先端へ向かって短くなる
      const taper = Math.sin((1 - t) * Math.PI * 0.62 + 0.22);
      const length = area.w * spread * taper * randFloat(rng, 0.9, 1.08);
      const rise = length * randFloat(rng, 0.42, 0.58);
      const lobes = Math.max(3, Math.round(6 * taper));

      for (const side of [1, -1]) {
        // 左右で少しずらすと、互生の実物らしい非対称になる
        const offsetIndex = Math.min(spine.length - 1, index + (side > 0 ? 0 : 1));
        const from = spine[offsetIndex] as Point;
        const pinnaTip: Point = { x: from.x + length * side, y: from.y - rise };
        drawPinna(ctx, from, pinnaTip, length * 0.17, lobes, scale);
      }
    }
  },
};
