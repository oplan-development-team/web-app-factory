import type { Family, Rarity, TiltBucket } from "./types.ts";

/**
 * チューニング値の単一情報源。
 * 数値をここ以外に散らさない — 分布テスト（AC-04 / AC-06）と不変条件テスト（AC-09）が
 * この定数を参照して検証するため、実装側とテスト側で二重定義しない。
 */

/** 抽選・表示の順序。累積比較の順でもあるので、並び順に意味がある（FR-030.2 / FR-031.2）。 */
export const FAMILIES: readonly Family[] = ["FLOW", "GRID", "RADIAL", "NOISE"] as const;
export const RARITIES: readonly Rarity[] = ["COMMON", "RARE", "EPIC"] as const;
export const BUCKETS: readonly TiltBucket[] = [
  "UPRIGHT",
  "LANDSCAPE",
  "DIAGONAL",
  "INVERTED",
] as const;

/** 系統の表示名（SPEC 2.1）。 */
export const FAMILY_LABEL: Readonly<Record<Family, { en: string; ja: string }>> = {
  FLOW: { en: "FLOW", ja: "ながれ" },
  GRID: { en: "GRID", ja: "こうし" },
  RADIAL: { en: "RADIAL", ja: "ほうしゃ" },
  NOISE: { en: "NOISE", ja: "ゆらぎ" },
};

/** 傾き区分のフレーバー表記（FR-402）。 */
export const BUCKET_LABEL: Readonly<Record<TiltBucket, string>> = {
  UPRIGHT: "たて",
  LANDSCAPE: "よこ",
  DIAGONAL: "ななめ",
  INVERTED: "さかさま",
};

/** 傾き区分と相性のよい系統（SPEC 2.1）。 */
export const BUCKET_AFFINITY: Readonly<Record<TiltBucket, Family>> = {
  UPRIGHT: "FLOW",
  LANDSCAPE: "GRID",
  DIAGONAL: "RADIAL",
  INVERTED: "NOISE",
};

/** 相性系統の重み。残りを他 3 系統で均等割りする（FR-030.1）。 */
export const AFFINITY_WEIGHT = 0.55;

/** レア度の重み。FR-031.1。合計は 1.00。 */
export const RARITY_WEIGHT: Readonly<Record<Rarity, number>> = {
  COMMON: 0.7,
  RARE: 0.25,
  EPIC: 0.05,
};

/** レア度 → 層の数（FR-102）。 */
export const RARITY_LAYERS: Readonly<Record<Rarity, number>> = {
  COMMON: 1,
  RARE: 2,
  EPIC: 3,
};

/** 追加層の不透明度（FR-102.2）。基層は 1.0。 */
export const LAYER_OPACITY: readonly number[] = [1, 0.55, 0.35] as const;

/** シェイク検出（FR-010）。 */
export const SHAKE = {
  /** |Δa| の閾値 (m/s²)。 */
  THRESHOLD: 18,
  /** これ未満の間隔のサンプルは無視する (ms)。 */
  MIN_SAMPLE_INTERVAL_MS: 40,
  /** 1 度検知したら次の検知を受け付けない時間 (ms)。 */
  COOLDOWN_MS: 900,
  /** 値を伴う devicemotion がこの時間内に 1 件も来なければセンサー不在とみなす (ms)。FR-021 */
  SENSOR_PROBE_MS: 1200,
} as const;

/** 傾き分類の閾値（FR-012）。判定順序は tilt.ts のコードが持つ。 */
export const TILT = {
  /** |beta| がこれ以上なら反転とみなす。 */
  INVERTED_ABS_BETA: 120,
  /** beta がこれ以下なら（水平を越えて奥へ倒れている）反転とみなす。 */
  INVERTED_BETA: -25,
  /** |gamma| がこれ以上なら横向き。 */
  LANDSCAPE_ABS_GAMMA: 45,
  /** 縦持ちと判定する beta の下限。 */
  UPRIGHT_MIN_BETA: 55,
  /** 縦持ちと判定する |gamma| の上限（これ未満）。 */
  UPRIGHT_MAX_ABS_GAMMA: 25,
} as const;

/** 模様の描画領域。すべての系統が共有する（FR-100）。 */
export const CANVAS = {
  SIZE: 240,
  CENTER: 120,
  /** 端に触れないための余白。 */
  MARGIN: 16,
} as const;

/** 1 標本あたりの描画要素数の上限（FR-110.2）。 */
export const MAX_ELEMENTS = 600;

/** 線幅の許容範囲（FR-101.2）。この外に出してはならない。 */
export const STROKE_WIDTH = { MIN: 0.6, MAX: 1.4 } as const;

/** localStorage のキー（FR-201）。 */
export const STORAGE_KEY = "tilt-gacha:collection:v1";

/** 保存スキーマのバージョン（FR-201.1）。 */
export const SCHEMA_VERSION = 1;

/** 型の総数（4 系統 × 3 レア度）。進捗表示の分母（FR-202）。 */
export const TOTAL_TYPES = FAMILIES.length * RARITIES.length;
