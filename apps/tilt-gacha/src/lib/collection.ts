import { FAMILIES, RARITIES, SCHEMA_VERSION, TOTAL_TYPES } from "./constants.ts";
import type {
  Collection,
  CollectionEntry,
  Family,
  Rarity,
  Specimen,
  TypeId,
} from "./types.ts";

/** 系統 × レア度から図鑑のマスを一意に指す ID を組み立てる。 */
export function typeIdOf(family: Family, rarity: Rarity): TypeId {
  return `${family}:${rarity}`;
}

/** 有効な型 ID の全集合。スキーマ検証で未知キーを弾くのに使う。 */
const VALID_TYPE_IDS: ReadonlySet<string> = new Set(
  FAMILIES.flatMap((f) => RARITIES.map((r) => typeIdOf(f, r))),
);

export function isValidTypeId(value: string): value is TypeId {
  return VALID_TYPE_IDS.has(value);
}

/** 1 回の記録の結果。「はじめて発見」の判定を呼び出し側へ返す（FR-200.3）。 */
export interface RecordResult {
  readonly collection: Collection;
  readonly isFirstDiscovery: boolean;
  readonly entry: CollectionEntry;
}

/**
 * 標本を図鑑へ記録する（FR-200）。
 *
 * 既存の Collection は変更せず、新しいオブジェクトを返す（イミュータブル）。
 * `firstSeed` / `firstAt` は初回のものを保ち続ける — 図鑑のマスの見た目は
 * 「そのとき引いたもの」で固定される、という収集の意味づけがこれに依存している（FR-200.2）。
 *
 * @param now 記録時刻。テストのために引数で受け取る（NFR-008.3）。
 */
export function recordSpecimen(
  collection: Collection,
  specimen: Specimen,
  now: Date,
): RecordResult {
  const id = typeIdOf(specimen.family, specimen.rarity);
  const existing = collection[id];
  const isFirstDiscovery = existing === undefined;

  const entry: CollectionEntry = isFirstDiscovery
    ? { count: 1, firstSeed: specimen.seed, firstAt: now.toISOString() }
    : { ...existing, count: existing.count + 1 };

  return {
    collection: { ...collection, [id]: entry },
    isFirstDiscovery,
    entry,
  };
}

/** 収集済みの型の数（FR-202）。通算取得数ではない。 */
export function collectedCount(collection: Collection): number {
  return Object.keys(collection).length;
}

/** 指定系統の収集済み数（図鑑のセクション見出し用。FR-501）。 */
export function collectedInFamily(collection: Collection, family: Family): number {
  return RARITIES.filter((r) => collection[typeIdOf(family, r)] !== undefined).length;
}

/** 全体進捗。分母は常に 12。 */
export function progress(collection: Collection): { collected: number; total: number } {
  return { collected: collectedCount(collection), total: TOTAL_TYPES };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** count は 1 以上の安全な整数でなければならない。 */
function isValidCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

/** firstSeed は 32bit 符号なし整数の範囲でなければならない。 */
function isValidSeed(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 0xffffffff
  );
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

/**
 * 永続化された JSON 文字列を Collection へ復元する（FR-201.2）。
 *
 * 壊れた入力で画面が壊れてはならないので、例外は投げず、
 * 検証を通らないエントリだけを黙って捨てる。全部捨てて空になるのも正常な結果。
 */
export function parseCollection(raw: string | null): Collection {
  if (raw === null || raw === "") return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (!isPlainObject(parsed)) return {};
  if (parsed["version"] !== SCHEMA_VERSION) return {};

  const entries = parsed["entries"];
  if (!isPlainObject(entries)) return {};

  const result: Record<string, CollectionEntry> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (!isValidTypeId(key)) continue;
    if (!isPlainObject(value)) continue;
    if (!isValidCount(value["count"])) continue;
    if (!isValidSeed(value["firstSeed"])) continue;
    if (!isValidTimestamp(value["firstAt"])) continue;
    result[key] = {
      count: value["count"],
      firstSeed: value["firstSeed"],
      firstAt: value["firstAt"],
    };
  }
  return result;
}

/** Collection を永続化用の JSON 文字列へ（FR-201.1）。 */
export function serializeCollection(collection: Collection): string {
  return JSON.stringify({ version: SCHEMA_VERSION, entries: collection });
}
