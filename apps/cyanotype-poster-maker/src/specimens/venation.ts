/**
 * 葉脈標本（インドボダイジュ）— 網状脈。
 *
 * 葉肉を落として脈だけを残した「葉脈標本」を写した図案。フォトグラムでは
 * 脈が厚いぶん光を強く遮って白く残り、脈と脈のあいだの薄い葉肉は光を透かす。
 * つまり階調そのものが脈の構造図になる。この標本だけは葉脈が主役なので、
 * 三次脈（網目）まで描く。
 */

import type { Ctx2D } from '../core/ctx2d';
import { jitter, randFloat, randInt, type Rng } from '../core/random';
import type { Specimen } from './types';
import {
  TONE,
  type Point,
  insetArea,
  lerpPoint,
  paintGround,
  paintOrgan,
  strokeOrgan,
} from './shared';

function curveTo(ctx: Ctx2D, from: Point, control: Point, to: Point): void {
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(control.x, control.y, to.x, to.y);
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

    // 葉柄
    const petioleBase: Point = { x: area.x + area.w * 0.5, y: area.y + area.h * 0.99 };
    const bladeBase: Point = { x: area.x + area.w * 0.5 + jitter(rng, area.w * 0.02), y: area.y + area.h * 0.8 };

    strokeOrgan(
      ctx,
      (c) => {
        c.moveTo(petioleBase.x, petioleBase.y);
        c.quadraticCurveTo(
          petioleBase.x + area.w * 0.03,
          (petioleBase.y + bladeBase.y) / 2,
          bladeBase.x,
          bladeBase.y,
        );
      },
      TONE.core,
      scale * 2.4,
      scale * 0.9,
    );

    // 葉身。ボダイジュは先が細く尾状に伸びる
    const halfWidth = area.w * randFloat(rng, 0.3, 0.36);
    const apex: Point = { x: bladeBase.x + jitter(rng, area.w * 0.03), y: area.y + area.h * 0.04 };
    const shoulder = lerpPoint(bladeBase, apex, 0.3);

    paintOrgan(
      ctx,
      (c) => {
        c.moveTo(bladeBase.x, bladeBase.y);
        // 基部はハート型に張り出し、上へ向かって細く尾を引く
        c.bezierCurveTo(
          bladeBase.x - halfWidth * 1.5,
          bladeBase.y - area.h * 0.02,
          shoulder.x - halfWidth * 1.25,
          shoulder.y - area.h * 0.12,
          apex.x - halfWidth * 0.06,
          apex.y,
        );
        c.bezierCurveTo(
          shoulder.x + halfWidth * 1.25,
          shoulder.y - area.h * 0.12,
          bladeBase.x + halfWidth * 1.5,
          bladeBase.y - area.h * 0.02,
          bladeBase.x,
          bladeBase.y,
        );
        c.closePath();
      },
      TONE.lamina,
      scale * 1.6,
    );

    // 主脈
    strokeOrgan(
      ctx,
      (c) => {
        c.moveTo(bladeBase.x, bladeBase.y);
        c.quadraticCurveTo((bladeBase.x + apex.x) / 2 + area.w * 0.01, (bladeBase.y + apex.y) / 2, apex.x, apex.y);
      },
      TONE.core,
      scale * 1.5,
      scale * 0.6,
    );

    // 二次脈（主脈から縁へ向かって弧を描く）
    const pairs = randInt(rng, 7, 9);
    const secondaries: Array<{ from: Point; to: Point; control: Point }> = [];

    for (let i = 0; i < pairs; i++) {
      const t = 0.06 + (i / (pairs - 1)) * 0.8;
      const from = lerpPoint(bladeBase, apex, t);
      const reach = halfWidth * Math.sin((1 - t) * Math.PI * 0.55 + 0.32) * randFloat(rng, 0.92, 1.06);
      const rise = area.h * randFloat(rng, 0.07, 0.11) * (1 - t * 0.4);

      for (const side of [1, -1]) {
        const to: Point = { x: from.x + reach * side, y: from.y - rise };
        const control: Point = { x: from.x + reach * 0.5 * side, y: from.y - rise * 0.15 };
        secondaries.push({ from, to, control });
        strokeOrgan(ctx, (c) => curveTo(c, from, control, to), TONE.rib, scale * 0.8, scale * 0.35);
      }
    }

    // 三次脈（二次脈のあいだを繋ぐ網目）— この標本の主役
    for (let i = 0; i < secondaries.length - 2; i++) {
      const a = secondaries[i];
      const b = secondaries[i + 2];
      if (!a || !b) continue;
      // 同じ側どうしを繋ぐ（i と i+2 が同じ側になる並び）
      const rungs = randInt(rng, 2, 4);
      for (let k = 1; k <= rungs; k++) {
        const t = k / (rungs + 1);
        const from = lerpPoint(a.from, a.to, t + randFloat(rng, -0.06, 0.06));
        const to = lerpPoint(b.from, b.to, t * randFloat(rng, 0.75, 0.95));
        const control: Point = {
          x: (from.x + to.x) / 2 + jitter(rng, area.w * 0.02),
          y: (from.y + to.y) / 2 + jitter(rng, area.h * 0.012),
        };
        strokeOrgan(ctx, (c) => curveTo(c, from, control, to), TONE.blade, scale * 0.42, scale * 0.2);
      }
    }
  },
};
