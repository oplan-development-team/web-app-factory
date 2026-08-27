/**
 * 海藻（ダルス）— 二叉分岐する膜状葉。
 *
 * Anna Atkins『Photographs of British Algae』(1843) の原典的題材。
 * 水中で広がった膜が印画紙に貼りつくため、輪郭は硬く、重なった部分だけが
 * 濃く白く残る。分岐が進むほど膜が薄くなり、透けて中間調になる。
 */

import type { Ctx2D } from '../core/ctx2d';
import { randFloat, randInt, type Rng } from '../core/random';
import type { Specimen } from './types';
import {
  TONE,
  type Point,
  insetArea,
  paintGround,
  paintOrgan,
  ribbonOutline,
  strokeOrgan,
  waveLeafOutline,
  wobbleSpine,
} from './shared';

interface Branch {
  base: Point;
  angle: number;
  length: number;
  width: number;
  depth: number;
}

function drawBranch(ctx: Ctx2D, branch: Branch, rng: Rng, scale: number, maxDepth: number): void {
  const { base, angle, length, width, depth } = branch;
  const tip: Point = {
    x: base.x + Math.sin(angle) * length,
    y: base.y - Math.cos(angle) * length,
  };

  // 分岐が進むほど膜が薄くなる
  const thinning = depth / maxDepth;
  const tone = TONE.blade - (TONE.blade - TONE.lamina) * thinning;
  const lobes = randInt(rng, 3, 6);

  paintOrgan(
    ctx,
    (c) => waveLeafOutline(c, base, tip, width, lobes, randFloat(rng, 0.12, 0.26)),
    tone,
    scale * (1.4 - thinning * 0.8),
  );

  // 中肋（葉の中心を走る厚い筋）
  strokeOrgan(
    ctx,
    (c) => {
      c.moveTo(base.x, base.y);
      c.lineTo(tip.x, tip.y);
    },
    TONE.rib,
    Math.max(0.8, width * 0.16),
    scale * 0.4,
  );

  if (depth >= maxDepth) return;

  // 二叉分岐
  const forks = randInt(rng, 2, 3);
  const spreadAngle = randFloat(rng, 0.34, 0.62);
  for (let i = 0; i < forks; i++) {
    const side = forks === 2 ? (i === 0 ? -1 : 1) : i - 1;
    drawBranch(
      ctx,
      {
        base: tip,
        angle: angle + side * spreadAngle * randFloat(rng, 0.7, 1.25),
        length: length * randFloat(rng, 0.55, 0.72),
        width: width * randFloat(rng, 0.54, 0.68),
        depth: depth + 1,
      },
      rng,
      scale,
      maxDepth,
    );
  }
}

export const ALGAE: Specimen = {
  id: 'algae',
  plateNo: 'PL. II',
  label: '海藻（ダルス）',
  scientificName: 'Delesseria sanguinea',
  commonName: 'ベニノリの一種',
  locality: '英国 ケント海岸',
  note: 'Atkins が 1843 年に焼き付けた原典的題材。二叉に分かれる膜状葉',

  draw(ctx, width, height, rng: Rng) {
    const seed = Math.floor(rng() * 1e9);
    paintGround(ctx, width, height, seed);

    const area = insetArea(width, height, 0.1);
    const scale = Math.min(area.w, area.h) / 100;

    // 付着器から立ち上がる主軸
    const holdfast: Point = { x: area.x + area.w * randFloat(rng, 0.44, 0.56), y: area.y + area.h * 0.98 };
    const stipeTop: Point = { x: holdfast.x + area.w * randFloat(rng, -0.06, 0.06), y: area.y + area.h * 0.7 };
    const stipe = wobbleSpine(holdfast, stipeTop, area.w * randFloat(rng, -0.04, 0.04), 12, rng, area.w * 0.02);

    paintOrgan(
      ctx,
      (c) => ribbonOutline(c, stipe, (t) => scale * (2.6 - t * 1.4)),
      TONE.core,
      scale * 0.9,
    );

    const maxDepth = randInt(rng, 3, 4);
    const primaries = randInt(rng, 2, 3);
    for (let i = 0; i < primaries; i++) {
      const spread = primaries === 1 ? 0 : (i / (primaries - 1) - 0.5) * 2;
      drawBranch(
        ctx,
        {
          base: stipeTop,
          angle: spread * randFloat(rng, 0.26, 0.44),
          length: area.h * randFloat(rng, 0.2, 0.27),
          width: area.w * randFloat(rng, 0.075, 0.105),
          depth: 1,
        },
        rng,
        scale,
        maxDepth,
      );
    }
  },
};
