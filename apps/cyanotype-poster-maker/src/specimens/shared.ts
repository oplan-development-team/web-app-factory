/**
 * 所蔵標本の共通作図（SPEC 3.1.2 / PLAN 3.3）。
 *
 * サイアノタイプのフォトグラムは、植物が光を遮って紙色のまま残り、露光した地が
 * 藍に沈む。ここで作るのはその「陰画」で、植物体が明部・地が暗部になる。
 * 二階調化されると、明部が紙色、暗部がインクのベタになる。
 */

import { createCanvas, gray, type Ctx2D } from '../core/ctx2d';
import { fbm2D, randFloat, type Rng } from '../core/random';

export interface Point {
  x: number;
  y: number;
}

/**
 * 部位ごとの階調（FR-122）。
 * 実際のフォトグラムでは、組織が厚いほど光を通さず白く残る。
 * 葉身のような薄い膜は光を透かすので中間調になる。
 */
export const TONE = {
  /** 地（露光部）の基準輝度 */
  groundBase: 42,
  /** 地の露光ムラの振れ幅 */
  groundSwing: 26,
  /** 薄い膜状の組織（透ける） */
  lamina: 162,
  /** 通常の葉身 */
  blade: 196,
  /** 葉脈・茎など厚い組織 */
  rib: 230,
  /** 最も厚い基部・種子など */
  core: 248,
} as const;

/** 半影のストローク回数。図形数にも解像度にも比例させない（PLAN 3.3）。 */
const PENUMBRA_PASSES = 3;

/**
 * 地（露光面）を塗る。
 *
 * 露光ムラは元来低周波なので、低解像度のノイズ面を作って拡大合成する。
 * 3600×4800 のプレートで画素ループを回すのは現実的でない。
 */
export function paintGround(ctx: Ctx2D, width: number, height: number, seed: number): void {
  ctx.fillStyle = gray(TONE.groundBase);
  ctx.fillRect(0, 0, width, height);

  const noiseW = 96;
  const noiseH = Math.max(8, Math.round((noiseW * height) / Math.max(1, width)));
  const { canvas, ctx: noiseCtx } = createCanvas(noiseW, noiseH);
  const image = noiseCtx.createImageData(noiseW, noiseH);
  const data = image.data;

  for (let y = 0; y < noiseH; y++) {
    for (let x = 0; x < noiseW; x++) {
      const idx = (y * noiseW + x) * 4;
      const n = fbm2D((x / noiseW) * 2.6, (y / noiseH) * 2.6, seed + 311, 4);
      const value = TONE.groundBase + (n - 0.5) * 2 * TONE.groundSwing;
      const v = Math.max(0, Math.min(255, value));
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  noiseCtx.putImageData(image, 0, 0);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(canvas, 0, 0, width, height);
  ctx.restore();
}

/**
 * 図形を「半影つき」で塗る（FR-122.3）。
 *
 * 印画紙に伏せた植物は、接している部分は硬い輪郭、浮いている部分は
 * ぼやけた輪郭になる。`ctx.filter = "blur()"` は使わない（WebKit の対応差と、
 * 拡大縮小合成での挙動差を避けるため）。代わりに同一パスを太らせながら
 * 低不透明度でストロークして半影を作る。描画回数はパスあたり固定。
 */
export function paintOrgan(ctx: Ctx2D, build: (ctx: Ctx2D) => void, tone: number, penumbra: number): void {
  const color = gray(tone);

  if (penumbra > 0) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    for (let pass = PENUMBRA_PASSES; pass >= 1; pass--) {
      ctx.globalAlpha = 0.14;
      ctx.lineWidth = (penumbra * 2 * pass) / PENUMBRA_PASSES;
      ctx.beginPath();
      build(ctx);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  build(ctx);
  ctx.fill();
  ctx.restore();
}

/** 線そのものが意匠である部位（細い葉脈・剛毛）を、半影つきで引く。 */
export function strokeOrgan(
  ctx: Ctx2D,
  build: (ctx: Ctx2D) => void,
  tone: number,
  lineWidth: number,
  penumbra: number,
): void {
  const color = gray(tone);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;

  if (penumbra > 0) {
    for (let pass = PENUMBRA_PASSES; pass >= 1; pass--) {
      ctx.globalAlpha = 0.13;
      ctx.lineWidth = lineWidth + (penumbra * 2 * pass) / PENUMBRA_PASSES;
      ctx.beginPath();
      build(ctx);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  build(ctx);
  ctx.stroke();
  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* 形の語彙                                                                    */
/* -------------------------------------------------------------------------- */

/** 2 点間を `t`(0..1) で内挿する */
export function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * 折れ線の背骨に沿って、太さが変化する帯（茎・中軸）の輪郭を組む。
 * 片側を進んで、反対側を戻る閉じたパスにする。
 */
export function ribbonOutline(ctx: Ctx2D, spine: readonly Point[], halfWidth: (t: number) => number): void {
  if (spine.length < 2) return;
  const left: Point[] = [];
  const right: Point[] = [];

  for (let i = 0; i < spine.length; i++) {
    const current = spine[i] as Point;
    const prev = (spine[i - 1] ?? current) as Point;
    const next = (spine[i + 1] ?? current) as Point;
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const hw = halfWidth(i / (spine.length - 1));
    left.push({ x: current.x + nx * hw, y: current.y + ny * hw });
    right.push({ x: current.x - nx * hw, y: current.y - ny * hw });
  }

  const first = left[0] as Point;
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < left.length; i++) {
    const p = left[i] as Point;
    ctx.lineTo(p.x, p.y);
  }
  for (let i = right.length - 1; i >= 0; i--) {
    const p = right[i] as Point;
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

/**
 * 基部から先端へ伸びる左右対称の葉身。
 * `bulge` が大きいほど幅の最大位置が基部寄りになり、丸みが増す。
 */
export function leafOutline(ctx: Ctx2D, base: Point, tip: Point, halfWidth: number, bulge: number): void {
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * halfWidth;
  const ny = (dx / len) * halfWidth;
  const belly = lerpPoint(base, tip, bulge);

  ctx.moveTo(base.x, base.y);
  ctx.quadraticCurveTo(belly.x + nx * 1.3, belly.y + ny * 1.3, tip.x, tip.y);
  ctx.quadraticCurveTo(belly.x - nx * 1.3, belly.y - ny * 1.3, base.x, base.y);
  ctx.closePath();
}

/**
 * 縁が波打つ膜状の葉身（海藻・裂けた羽片に使う）。
 * `lobes` の数だけ縁が出入りする。
 */
export function waveLeafOutline(
  ctx: Ctx2D,
  base: Point,
  tip: Point,
  halfWidth: number,
  lobes: number,
  depth: number,
): void {
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const steps = Math.max(6, lobes * 4);

  const edge = (side: number, t: number): Point => {
    const wave = Math.sin(t * Math.PI * lobes) * depth;
    const profile = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ** 0.7;
    const w = halfWidth * profile * (1 + wave);
    return {
      x: base.x + ux * len * t + nx * w * side,
      y: base.y + uy * len * t + ny * w * side,
    };
  };

  ctx.moveTo(base.x, base.y);
  for (let i = 1; i <= steps; i++) ctx.lineTo(edge(1, i / steps).x, edge(1, i / steps).y);
  for (let i = steps; i >= 0; i--) ctx.lineTo(edge(-1, i / steps).x, edge(-1, i / steps).y);
  ctx.closePath();
}

/** 円弧を描く背骨。茎の自然な湾曲に使う。 */
export function arcSpine(base: Point, tip: Point, bend: number, steps: number): Point[] {
  const points: Point[] = [];
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const offset = Math.sin(t * Math.PI) * bend;
    points.push({ x: base.x + dx * t + nx * offset, y: base.y + dy * t + ny * offset });
  }
  return points;
}

/** 揺らぎを持つ背骨。同じ弧でも個体ごとに癖が出る。 */
export function wobbleSpine(base: Point, tip: Point, bend: number, steps: number, rng: Rng, amount: number): Point[] {
  const spine = arcSpine(base, tip, bend, steps);
  const phase = randFloat(rng, 0, Math.PI * 2);
  const freq = randFloat(rng, 1.4, 2.8);
  return spine.map((p, i) => {
    const t = i / (spine.length - 1);
    const sway = Math.sin(phase + t * Math.PI * freq) * amount * t;
    return { x: p.x + sway, y: p.y };
  });
}

/** 図案が描画領域に収まるよう、共通の余白を返す。 */
export function insetArea(width: number, height: number, ratio = 0.08): { x: number; y: number; w: number; h: number } {
  const mx = width * ratio;
  const my = height * ratio;
  return { x: mx, y: my, w: width - mx * 2, h: height - my * 2 };
}
