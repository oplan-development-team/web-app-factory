/**
 * 植物紋。日本の家紋で最も層の厚い分類で、いずれも
 * 「葉・花弁の面を大きく取り、内部を白抜きの脈で割る」構成を共有する。
 */

import {
  type Point,
  type Segment,
  circleSegments,
  symmetricOutline,
  translateSegments,
} from "../geometry";
import { type Rng, randFloat } from "../hash";
import { finishUnit, vein, withCuts } from "./shared";
import type { Motif, UnitGeometry } from "./types";

/** 先の尖った紡錘形（桐の花序・扇の要などに使う小さな塊） */
function spike(base: Point, tip: Point, halfWidth: number): Segment[] {
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * halfWidth;
  const ny = (dx / len) * halfWidth;
  const mid: Point = { x: base.x + dx * 0.42, y: base.y + dy * 0.42 };
  return [
    { t: "M", p: base },
    { t: "Q", c: { x: mid.x + nx * 1.15, y: mid.y + ny * 1.15 }, p: tip },
    { t: "Q", c: { x: mid.x - nx * 1.15, y: mid.y - ny * 1.15 }, p: base },
    { t: "Z" },
  ];
}

/* -------------------------------------------------------------------------- */

function buildKashiwa(rng: Rng, L: number): UnitGeometry {
  const W = L * randFloat(rng, 0.44, 0.5);
  const body = symmetricOutline([
    { to: { x: 0.26 * W, y: -0.08 * L } },
    { control: { x: 0.78 * W, y: -0.13 * L }, to: { x: 0.88 * W, y: -0.28 * L } },
    { control: { x: 0.7 * W, y: -0.38 * L }, to: { x: 0.64 * W, y: -0.44 * L } },
    { control: { x: 0.98 * W, y: -0.52 * L }, to: { x: 1.0 * W, y: -0.63 * L } },
    { control: { x: 0.86 * W, y: -0.72 * L }, to: { x: 0.68 * W, y: -0.76 * L } },
    { control: { x: 0.84 * W, y: -0.86 * L }, to: { x: 0.44 * W, y: -0.94 * L } },
    { control: { x: 0.22 * W, y: -0.99 * L }, to: { x: 0, y: -L } },
  ]);

  const main = vein({ x: 0, y: -0.1 * L }, { x: 0, y: -0.88 * L }, L * 0.065, L * 0.025);
  const rightRib = vein(
    { x: 0, y: -0.34 * L },
    { x: 0.5 * W, y: -0.52 * L },
    L * 0.05,
    L * 0.022,
  );
  const leftRib = vein(
    { x: 0, y: -0.34 * L },
    { x: -0.5 * W, y: -0.52 * L },
    L * 0.05,
    L * 0.022,
  );

  return finishUnit([withCuts(body, main, rightRib, leftRib)]);
}

function buildKiri(rng: Rng, L: number): UnitGeometry {
  const W = L * randFloat(rng, 0.4, 0.46);
  const leaf = symmetricOutline([
    { to: { x: 0.3 * W, y: -0.03 * L } },
    { control: { x: 0.86 * W, y: -0.06 * L }, to: { x: 0.98 * W, y: -0.22 * L } },
    { control: { x: 0.9 * W, y: -0.42 * L }, to: { x: 0.52 * W, y: -0.52 * L } },
    { control: { x: 0.24 * W, y: -0.56 * L }, to: { x: 0, y: -0.56 * L } },
  ]);

  const ribs = [
    vein({ x: 0, y: -0.04 * L }, { x: 0, y: -0.48 * L }, L * 0.05, L * 0.02),
    vein({ x: 0, y: -0.04 * L }, { x: 0.62 * W, y: -0.32 * L }, L * 0.05, L * 0.02),
    vein({ x: 0, y: -0.04 * L }, { x: -0.62 * W, y: -0.32 * L }, L * 0.05, L * 0.02),
  ];

  // 花序: 中央が高く、両脇が低い三本立ち（五三桐・五七桐の構成）
  const centerSpike = spike(
    { x: 0, y: -0.5 * L },
    { x: 0, y: -1.0 * L },
    W * 0.29,
  );
  const sideTipY = randFloat(rng, -0.88, -0.82) * L;
  const rightSpike = spike(
    { x: 0.26 * W, y: -0.46 * L },
    { x: 0.6 * W, y: sideTipY },
    W * 0.25,
  );
  const leftSpike = spike(
    { x: -0.26 * W, y: -0.46 * L },
    { x: -0.6 * W, y: sideTipY },
    W * 0.25,
  );

  return finishUnit([withCuts(leaf, ...ribs), centerSpike, rightSpike, leftSpike]);
}

function buildKikyou(rng: Rng, L: number): UnitGeometry {
  const W = L * randFloat(rng, 0.42, 0.5);
  const body = symmetricOutline([
    { to: { x: 0.16 * W, y: -0.06 * L } },
    { control: { x: 0.92 * W, y: -0.2 * L }, to: { x: 1.0 * W, y: -0.5 * L } },
    { control: { x: 0.8 * W, y: -0.85 * L }, to: { x: 0, y: -L } },
  ]);
  const rib = vein({ x: 0, y: -0.14 * L }, { x: 0, y: -0.8 * L }, L * 0.06, L * 0.018);
  return finishUnit([withCuts(body, rib)]);
}

function hanabishiOutline(L: number, W: number): Segment[] {
  return symmetricOutline([
    { control: { x: 0.16 * W, y: -0.26 * L }, to: { x: W, y: -0.5 * L } },
    { control: { x: 0.16 * W, y: -0.74 * L }, to: { x: 0, y: -L } },
  ]);
}

function buildHanabishi(rng: Rng, L: number): UnitGeometry {
  const W = L * randFloat(rng, 0.44, 0.5);
  const body = hanabishiOutline(L, W);
  const innerScale = randFloat(rng, 0.36, 0.44);
  const inner = translateSegments(
    hanabishiOutline(L * innerScale, W * innerScale),
    0,
    -(0.5 - innerScale / 2) * L,
  );
  return finishUnit([withCuts(body, inner)]);
}

function buildOmodaka(rng: Rng, L: number): UnitGeometry {
  const W = L * randFloat(rng, 0.42, 0.48);
  const body = symmetricOutline([
    { to: { x: 0.3 * W, y: -0.04 * L } },
    { to: { x: 1.0 * W, y: -0.2 * L } },
    { control: { x: 0.9 * W, y: -0.46 * L }, to: { x: 0.46 * W, y: -0.6 * L } },
    { control: { x: 0.34 * W, y: -0.82 * L }, to: { x: 0, y: -L } },
  ]);
  const rib = vein({ x: 0, y: -0.2 * L }, { x: 0, y: -0.88 * L }, L * 0.055, L * 0.018);
  return finishUnit([withCuts(body, rib)]);
}

function buildTachibana(rng: Rng, L: number): UnitGeometry {
  const W = L * randFloat(rng, 0.5, 0.56);
  const leaf = symmetricOutline([
    { to: { x: 0.3 * W, y: -0.02 * L } },
    { control: { x: 0.92 * W, y: -0.04 * L }, to: { x: 1.0 * W, y: -0.22 * L } },
    { control: { x: 0.86 * W, y: -0.4 * L }, to: { x: 0.4 * W, y: -0.48 * L } },
    { control: { x: 0.16 * W, y: -0.5 * L }, to: { x: 0, y: -0.5 * L } },
  ]);
  const ribs = [
    vein({ x: 0, y: -0.04 * L }, { x: 0.62 * W, y: -0.24 * L }, L * 0.05, L * 0.02),
    vein({ x: 0, y: -0.04 * L }, { x: -0.62 * W, y: -0.24 * L }, L * 0.05, L * 0.02),
  ];

  const center: Point = { x: 0, y: -0.72 * L };
  const fruit = circleSegments(center, 0.27 * L);
  const calyx = circleSegments(center, 0.14 * L);
  const seed = circleSegments(center, 0.065 * L);

  return finishUnit([withCuts(leaf, ...ribs), withCuts(fruit, calyx), seed]);
}

function buildTsuta(rng: Rng, L: number): UnitGeometry {
  const W = L * randFloat(rng, 0.42, 0.48);
  const body = symmetricOutline([
    { to: { x: 0.2 * W, y: -0.05 * L } },
    { control: { x: 0.66 * W, y: -0.06 * L }, to: { x: 0.8 * W, y: -0.22 * L } },
    { control: { x: 0.98 * W, y: -0.34 * L }, to: { x: 0.84 * W, y: -0.46 * L } },
    { control: { x: 0.6 * W, y: -0.54 * L }, to: { x: 0.54 * W, y: -0.6 * L } },
    { control: { x: 0.76 * W, y: -0.76 * L }, to: { x: 0.44 * W, y: -0.88 * L } },
    { control: { x: 0.24 * W, y: -0.97 * L }, to: { x: 0, y: -L } },
  ]);
  const cuts = [
    vein({ x: 0, y: -0.1 * L }, { x: 0, y: -0.86 * L }, L * 0.06, L * 0.02),
    vein({ x: 0, y: -0.26 * L }, { x: 0.56 * W, y: -0.34 * L }, L * 0.05, L * 0.02),
    vein({ x: 0, y: -0.26 * L }, { x: -0.56 * W, y: -0.34 * L }, L * 0.05, L * 0.02),
  ];
  return finishUnit([withCuts(body, ...cuts)]);
}

/* -------------------------------------------------------------------------- */

export const PLANT_MOTIFS: readonly Motif[] = [
  {
    id: "kashiwa",
    label: "柏",
    category: "plant",
    supports: [{ kind: "radial", counts: [3] }, { kind: "single" }],
    buildUnit: buildKashiwa,
  },
  {
    id: "kiri",
    label: "桐",
    category: "plant",
    supports: [{ kind: "radial", counts: [3] }, { kind: "single" }],
    buildUnit: buildKiri,
  },
  {
    id: "kikyou",
    label: "桔梗",
    category: "plant",
    supports: [{ kind: "radial", counts: [5] }],
    buildUnit: buildKikyou,
  },
  {
    id: "hanabishi",
    label: "花菱",
    category: "plant",
    // 花菱は 4 弁で 1 つの意匠。単弁だけを大きく置くと紋名と図が食い違うため単独構成は持たない
    supports: [{ kind: "radial", counts: [4] }],
    buildUnit: buildHanabishi,
  },
  {
    id: "omodaka",
    label: "沢瀉",
    category: "plant",
    supports: [{ kind: "radial", counts: [3] }, { kind: "single" }],
    buildUnit: buildOmodaka,
  },
  {
    id: "tachibana",
    label: "橘",
    category: "plant",
    supports: [{ kind: "radial", counts: [3, 4] }],
    buildUnit: buildTachibana,
  },
  {
    id: "tsuta",
    label: "蔦",
    category: "plant",
    supports: [{ kind: "radial", counts: [3] }, { kind: "single" }],
    buildUnit: buildTsuta,
  },
] as const;

