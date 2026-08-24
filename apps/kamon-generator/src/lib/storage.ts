/**
 * 図版帖の永続化（SPEC 3.4 / FR-301）。
 *
 * 保存するのはシード文字列とバリアント番号だけで、幾何構造は保存しない。
 * 生成器が決定的なので、読み込み時に同じ図版を完全に復元できる。
 * 構造を保存すると、生成ロジックを更新したときに古い構造が残って不整合を起こす。
 */

export const STORAGE_KEY = "kamon-generator/plates/v1";
export const MAX_PLATES = 60;

export interface PlateRecord {
  plateNo: number;
  name: string;
  birthday: string;
  seedText: string;
  variantIndex: number;
  savedAt: number;
}

/** localStorage 互換の最小インタフェース（テストから差し替えるため） */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isPlateRecord(value: unknown): value is PlateRecord {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["plateNo"] === "number" &&
    Number.isFinite(v["plateNo"]) &&
    typeof v["name"] === "string" &&
    typeof v["birthday"] === "string" &&
    typeof v["seedText"] === "string" &&
    v["seedText"].length > 0 &&
    typeof v["variantIndex"] === "number" &&
    Number.isInteger(v["variantIndex"]) &&
    v["variantIndex"] >= 0 &&
    typeof v["savedAt"] === "number"
  );
}

/**
 * 保存済みの図版を読み込む。
 * 壊れた項目は黙って捨て、残りだけを返す（FR-301.3）。
 */
export function loadPlates(store: KeyValueStore | null): PlateRecord[] {
  if (!store) return [];
  let raw: string | null;
  try {
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.filter(isPlateRecord).slice(-MAX_PLATES);
}

/**
 * 図版を保存する。上限を超えた分は古いものから捨てる（FR-301.2）。
 * 保存に失敗しても例外を投げず false を返す（FR-301.4）。
 */
export function savePlates(store: KeyValueStore | null, plates: readonly PlateRecord[]): boolean {
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(plates.slice(-MAX_PLATES)));
    return true;
  } catch {
    return false;
  }
}

export function clearPlates(store: KeyValueStore | null): boolean {
  if (!store) return false;
  try {
    store.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** 上限を守りつつ 1 件追加した配列を返す（元の配列は変更しない） */
export function appendPlate(
  plates: readonly PlateRecord[],
  plate: PlateRecord,
): PlateRecord[] {
  return [...plates, plate].slice(-MAX_PLATES);
}

/** 同一シード・同一バリアントの図版を探す（重複記録の防止 / FR-300.2） */
export function findPlate(
  plates: readonly PlateRecord[],
  seedText: string,
  variantIndex: number,
): PlateRecord | undefined {
  return plates.find((p) => p.seedText === seedText && p.variantIndex === variantIndex);
}

/**
 * 利用可能なら localStorage を返す。
 * プライベートモードなどでアクセス自体が例外になる環境があるため、実際に読み書きして確かめる。
 */
export function resolveStore(candidate: KeyValueStore | undefined): KeyValueStore | null {
  if (!candidate) return null;
  const probe = `${STORAGE_KEY}/probe`;
  try {
    candidate.setItem(probe, "1");
    candidate.removeItem(probe);
    return candidate;
  } catch {
    return null;
  }
}
