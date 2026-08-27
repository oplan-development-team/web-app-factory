/**
 * ノラニンジン — 散形花序。
 *
 * 一点から放射した柄の先で、さらに小さな散形が開く入れ子構造。
 * 全体は円い塊に見えるのに、近づくと無数の点の集まりであるという密度の
 * 落差が、誤差拡散ハーフトーンと相性が良い。
 */

import { jitter, randFloat, randInt, type Rng } from '../core/random';
import type { Specimen } from './types';
import {
  TONE,
  type Point,
  insetArea,
  leafOutline,
  paintGround,
  paintOrgan,
  ribbonOutline,
  strokeOrgan,
  wobbleSpine,
} from './shared';

export const UMBEL: Specimen = {
  id: 'umbel',
  plateNo: 'PL. VI',
  label: 'ノラニンジン',
  scientificName: 'Daucus carota',
  commonName: 'ノラニンジン',
  locality: '北海道 美瑛町',
  note: '入れ子の散形花序。遠目の塊と近接の点描の落差が出る',

  draw(ctx, width, height, rng: Rng) {
    const seed = Math.floor(rng() * 1e9);
    paintGround(ctx, width, height, seed);

    const area = insetArea(width, height, 0.09);
    const scale = Math.min(area.w, area.h) / 100;

    const base: Point = { x: area.x + area.w * randFloat(rng, 0.46, 0.54), y: area.y + area.h * 0.995 };
    const crown: Point = { x: base.x + jitter(rng, area.w * 0.05), y: area.y + area.h * randFloat(rng, 0.4, 0.48) };
    const stem = wobbleSpine(base, crown, area.w * randFloat(rng, -0.05, 0.05), 22, rng, area.w * 0.014);

    paintOrgan(
      ctx,
      (c) => ribbonOutline(c, stem, (t) => scale * (1.9 - t * 1.0)),
      TONE.rib,
      scale * 0.7,
    );

    // 茎の途中から出る羽状の葉
    const leafCount = randInt(rng, 2, 3);
    for (let i = 0; i < leafCount; i++) {
      const t = randFloat(rng, 0.1, 0.55);
      const anchor = stem[Math.round(t * (stem.length - 1))] as Point;
      const side = i % 2 === 0 ? 1 : -1;
      const reach = area.w * randFloat(rng, 0.16, 0.26);
      const rachisTip: Point = { x: anchor.x + reach * side, y: anchor.y - reach * randFloat(rng, 0.4, 0.75) };
      strokeOrgan(
        ctx,
        (c) => {
          c.moveTo(anchor.x, anchor.y);
          c.lineTo(rachisTip.x, rachisTip.y);
        },
        TONE.rib,
        scale * 0.5,
        scale * 0.2,
      );
      const leaflets = randInt(rng, 4, 6);
      for (let k = 1; k <= leaflets; k++) {
        const lt = k / (leaflets + 1);
        const at: Point = {
          x: anchor.x + (rachisTip.x - anchor.x) * lt,
          y: anchor.y + (rachisTip.y - anchor.y) * lt,
        };
        const size = reach * randFloat(rng, 0.16, 0.26);
        for (const s of [1, -1]) {
          const tip: Point = { x: at.x + size * 0.7 * s, y: at.y - size };
          paintOrgan(ctx, (c) => leafOutline(c, at, tip, size * 0.2, 0.4), TONE.lamina, scale * 0.5);
        }
      }
    }

    // 散形花序: 一点から放射する柄
    const rays = randInt(rng, 16, 24);
    const canopy = area.w * randFloat(rng, 0.33, 0.42);
    const dome = canopy * randFloat(rng, 0.34, 0.5);

    for (let i = 0; i < rays; i++) {
      const t = rays === 1 ? 0.5 : i / (rays - 1);
      // 上に凸の傘型に並べる（両端ほど低く、中央ほど高い）
      const angle = (t - 0.5) * Math.PI * randFloat(rng, 0.92, 1.02);
      const len = canopy * randFloat(rng, 0.86, 1.0);
      const rayTip: Point = {
        x: crown.x + Math.sin(angle) * len,
        y: crown.y - dome * Math.cos(angle) - jitter(rng, dome * 0.06),
      };

      strokeOrgan(
        ctx,
        (c) => {
          c.moveTo(crown.x, crown.y);
          c.quadraticCurveTo(
            crown.x + Math.sin(angle) * len * 0.5,
            crown.y - dome * 0.35,
            rayTip.x,
            rayTip.y,
          );
        },
        TONE.blade,
        Math.max(0.6, scale * 0.34),
        scale * 0.18,
      );

      // 小散形（柄の先でさらに開く点の集まり）
      const florets = randInt(rng, 7, 12);
      const cluster = canopy * randFloat(rng, 0.07, 0.11);
      for (let f = 0; f < florets; f++) {
        const fa = (f / florets) * Math.PI * 2;
        const fr = cluster * randFloat(rng, 0.35, 1);
        const cx = rayTip.x + Math.cos(fa) * fr;
        const cy = rayTip.y + Math.sin(fa) * fr * 0.62;
        const dotRadius = Math.max(0.7, scale * randFloat(rng, 0.5, 0.85));
        paintOrgan(
          ctx,
          (c) => c.arc(cx, cy, dotRadius, 0, Math.PI * 2),
          TONE.core,
          dotRadius * 0.8,
        );
      }
    }
  },
};
