/** 模様の骨格。図鑑のセクション 1 つに対応する（SPEC 2.1）。 */
export type Family = "FLOW" | "GRID" | "RADIAL" | "NOISE";

/** レア度。層の数として視覚化される（FR-102）。 */
export type Rarity = "COMMON" | "RARE" | "EPIC";

/** シェイク検知時の姿勢の分類（FR-012）。 */
export type TiltBucket = "UPRIGHT" | "LANDSCAPE" | "DIAGONAL" | "INVERTED";

/** 系統 × レア度。図鑑のマス 1 つに対応する。例: `FLOW:RARE`。 */
export type TypeId = `${Family}:${Rarity}`;

/** 1 回の抽選結果。`seed` と型だけで模様を完全に再生成できる（FR-100）。 */
export interface Specimen {
  readonly family: Family;
  readonly rarity: Rarity;
  /** jitter を決める 32bit 符号なし整数（FR-032）。 */
  readonly seed: number;
  /** 検知した姿勢。センサーが無く割り当てられなかった場合は null（FR-020.2 で別途割り当てる）。 */
  readonly bucket: TiltBucket | null;
  /** センサー由来か、フォールバックでランダム割り当てされたか（FR-053 の表示に使う）。 */
  readonly fromSensor: boolean;
}

/** 図鑑に記録された 1 つの型の状態（FR-200.1）。 */
export interface CollectionEntry {
  /** 通算取得数。1 以上。 */
  readonly count: number;
  /** 初回に引いた標本のシード。図鑑のサムネイルはこれから再生成する（FR-200.2）。 */
  readonly firstSeed: number;
  /** 初回取得時刻（ISO 8601）。 */
  readonly firstAt: string;
}

/** 図鑑全体。未収集の型はキーごと存在しない。 */
export type Collection = Readonly<Partial<Record<TypeId, CollectionEntry>>>;

/** 乱数源。`[0, 1)` を返す。テストのために必ず引数で受け取る（NFR-008.3）。 */
export type Rng = () => number;

/** 生成された模様 1 枚分の SVG 中身（`<svg>` タグの内側）。 */
export interface Pattern {
  /** `<svg>` の内側に入る要素文字列。色は currentColor で描く（FR-101.3）。 */
  readonly markup: string;
  /** 描画要素数。上限 600 の検証に使う（FR-110.2）。 */
  readonly elementCount: number;
  /** 層の数。レア度と 1:1 で対応する（FR-102）。 */
  readonly layerCount: number;
}
