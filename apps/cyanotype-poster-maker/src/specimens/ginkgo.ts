/**
 * イチョウ — 扇形の葉身と二叉分枝する平行脈。
 *
 * イチョウの脈は網目をつくらず、基部から扇の骨のように分かれながら
 * 縁まで平行に走る（二叉分枝脈）。網状脈の葉（PL. III）と並べたときに、
 * 脈の走り方の違いがそのまま図案の違いになる。
 */

import type { Ctx2D } from '../core/ctx2d';
import { jitter, randFloat, randInt, type Rng } from '../core/random';
import type { Specimen } from './types';
import { TONE, type Point, insetArea, paintGround, paintOrgan, strokeOrgan } from './shared';

interface Fan {
  center: Point;
  radius: number;
  halfAngle: number;
  /** 葉身中央の切れ込みの深さ（0 で切れ込み無し） */
  cleft: number;
  tilt: number;
}

function fanOutline(ctx: Ctx2D, fan: Fan, wobble: (t: number) => number): void {
  const { center, radius, halfAngle, tilt } = fan;
  const steps = 40;
  const at = (angle: number, r: number): Point => ({
    x: center.x + Math.sin(angle + tilt) * r,
    y: center.y - Math.cos(angle + tilt) * r,
  });

  ctx.moveTo(center.x, center.y);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = -halfAngle + halfAngle * 2 * t;
    // 中央の切れ込み: 扇の中心付近だけ半径を縮める
    const notch = fan.cleft * Math.exp(-((t - 0.5) ** 2) / 0.004);
    const p = at(angle, radius * (1 + wobble(t)) * (1 - notch));
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

export const GINKGO: Specimen = {
  id: 'ginkgo',
  plateNo: 'PL. IV',
  label: 'イチョウ',
  scientificName: 'Ginkgo biloba',
  commonName: 'イチョウ',
  locality: '東京都 小石川植物園',
  note: '網目をつくらず扇の骨のように分かれる二叉分枝脈',

  draw(ctx, width, height, rng: Rng) {
    const seed = Math.floor(rng() * 1e9);
    paintGround(ctx, width, height, seed);

    const area = insetArea(width, height, 0.11);
    const scale = Math.min(area.w, area.h) / 100;

    // 短枝から 2〜3 枚が束になって出る
    const leaves = randInt(rng, 2, 3);
    const stalkBase: Point = { x: area.x + area.w * 0.5, y: area.y + area.h * 0.99 };

    for (let i = 0; i < leaves; i++) {
      const spread = leaves === 1 ? 0 : (i / (leaves - 1) - 0.5) * 2;
      const tilt = spread * randFloat(rng, 0.28, 0.46);
      const petioleLength = area.h * randFloat(rng, 0.28, 0.42) * (1 - Math.abs(spread) * 0.16);
      const center: Point = {
        x: stalkBase.x + Math.sin(tilt) * petioleLength,
        y: stalkBase.y - Math.cos(tilt) * petioleLength,
      };

      // 葉柄
      strokeOrgan(
        ctx,
        (c) => {
          c.moveTo(stalkBase.x, stalkBase.y);
          c.quadraticCurveTo(
            stalkBase.x + Math.sin(tilt) * petioleLength * 0.4,
            stalkBase.y - petioleLength * 0.55,
            center.x,
            center.y,
          );
        },
        TONE.core,
        scale * 1.5,
        scale * 0.5,
      );

      const radius = area.h * randFloat(rng, 0.3, 0.4) * (1 - Math.abs(spread) * 0.1);
      const halfAngle = randFloat(rng, 0.62, 0.82);
      const cleft = randFloat(rng, 0.0, 0.26);
      const wobblePhase = randFloat(rng, 0, Math.PI * 2);
      const wobbleFreq = randInt(rng, 5, 9);
      const wobble = (t: number): number => Math.sin(wobblePhase + t * Math.PI * wobbleFreq) * 0.035;

      const fan: Fan = { center, radius, halfAngle, cleft, tilt };
      paintOrgan(ctx, (c) => fanOutline(c, fan, wobble), TONE.blade, scale * 1.5);

      // 二叉分枝脈: 基部から出た脈が途中で 2 本へ割れながら縁へ向かう
      const primaries = randInt(rng, 7, 10);
      for (let v = 0; v < primaries; v++) {
        const t = (v + 0.5) / primaries;
        const angle = -halfAngle + halfAngle * 2 * t;
        const notch = cleft * Math.exp(-((t - 0.5) ** 2) / 0.004);
        const outer = radius * (1 - notch) * 0.96;
        const forkAt = randFloat(rng, 0.42, 0.6);
        const forkSpread = randFloat(rng, 0.035, 0.07);

        const point = (a: number, r: number): Point => ({
          x: center.x + Math.sin(a + tilt) * r,
          y: center.y - Math.cos(a + tilt) * r,
        });

        const fork = point(angle, outer * forkAt);
        strokeOrgan(
          ctx,
          (c) => {
            c.moveTo(center.x, center.y);
            c.lineTo(fork.x, fork.y);
          },
          TONE.rib,
          scale * 0.55,
          scale * 0.22,
        );

        for (const side of [-1, 1]) {
          const end = point(angle + side * forkSpread + jitter(rng, 0.012), outer);
          strokeOrgan(
            ctx,
            (c) => {
              c.moveTo(fork.x, fork.y);
              c.lineTo(end.x, end.y);
            },
            TONE.rib,
            scale * 0.42,
            scale * 0.18,
          );
        }
      }
    }
  },
};
