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

/** 枝が倒れてよい最大角（ラジアン）。約 63 度。 */
const MAX_TILT = 1.1;

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
    Math.max(0.8, width * 0.2),
    scale * 0.4,
  );

  if (depth >= maxDepth) return;

  // 二叉分岐。名前のとおり必ず 2 本へ割る。3 本以上に割ると、枝どうしが
  // 重なって全体が一塊の染みに見えてしまう
  //
  // 分岐角は深さとともに狭める。一定のまま重ねると角度が累積して枝が
  // ほぼ水平まで倒れ、描画領域の外へ逃げる（不変条件テストで検出した）
  const spreadAngle = randFloat(rng, 0.42, 0.66) * (1 - depth * 0.16);
  for (const side of [-1, 1]) {
    const nextAngle = angle + side * spreadAngle * randFloat(rng, 0.78, 1.2);
    drawBranch(
      ctx,
      {
        base: tip,
        // 水平を超えて倒れないように留める
        angle: Math.max(-MAX_TILT, Math.min(MAX_TILT, nextAngle)),
        length: length * randFloat(rng, 0.7, 0.85),
        width: width * randFloat(rng, 0.62, 0.74),
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
    const stipeTop: Point = { x: holdfast.x + area.w * randFloat(rng, -0.06, 0.06), y: area.y + area.h * 0.8 };
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
          angle: spread * randFloat(rng, 0.3, 0.5),
          // 葉は細長い披針形にする。幅を取りすぎると隣の枝と癒着して
          // 分岐の構造が読めなくなる
          length: area.h * randFloat(rng, 0.2, 0.26),
          width: area.w * randFloat(rng, 0.042, 0.058),
          depth: 1,
        },
        rng,
        scale,
        maxDepth,
      );
    }
  },
};
