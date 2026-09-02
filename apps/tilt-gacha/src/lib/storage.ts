import { STORAGE_KEY } from "./constants.ts";
import { parseCollection, serializeCollection } from "./collection.ts";
import type { Collection } from "./types.ts";

/**
 * 図鑑の永続化（FR-201）。
 *
 * Safari のプライベートモード・容量超過・埋め込み文脈など、
 * localStorage が「存在するのに例外を投げる」環境が現実にある。
 * そのためすべての呼び出しを try/catch で包み、失敗しても呼び出し側へ
 * 例外を伝播させない。永続化できないことはアプリの停止理由にならない（FR-201.3）。
 */

/** 必要な操作だけを要求する narrow interface。テストで差し替えやすくする。 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LoadResult {
  readonly collection: Collection;
  /** 永続化が実際に可能か。false なら図鑑画面でその旨を伝える（FR-201.3）。 */
  readonly persistent: boolean;
}

const PROBE_KEY = "tilt-gacha:probe";

/** localStorage を名乗るオブジェクトが実際に必要な操作を持っているか。 */
function hasStorageApi(value: unknown): value is StorageLike {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<StorageLike>;
  return (
    typeof candidate.getItem === "function" &&
    typeof candidate.setItem === "function" &&
    typeof candidate.removeItem === "function"
  );
}

/**
 * 実行環境の localStorage を返す。
 *
 * 参照自体が例外を投げる環境があるのでアクセスを try で包み、さらに形も検査する。
 * 「存在するが getItem を持たない」localStorage が現実にある
 * （Node 25 の組み込み実装がこれで、--localstorage-file 無しでは実質使えない）。
 * 検査しないと呼び出し時に TypeError になるため、その場合は null 扱いにする。
 */
export function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return hasStorageApi(localStorage) ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * 実際に書けるかを 1 往復のプローブで確かめる。
 *
 * 「存在するか」では判定できない: Safari のプライベートモードは
 * 読み出しは成功するのに setItem だけ例外を投げるため、
 * 存在チェックだけだと「保存できている」と誤って表示してしまう。
 */
export function isWritable(storage: StorageLike | null): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(PROBE_KEY, "1");
    storage.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function loadCollection(storage: StorageLike | null): LoadResult {
  if (storage === null) return { collection: {}, persistent: false };

  let collection: Collection = {};
  try {
    collection = parseCollection(storage.getItem(STORAGE_KEY));
  } catch {
    collection = {};
  }
  return { collection, persistent: isWritable(storage) };
}

/** @returns 書き込みに成功したか。失敗しても例外は投げない（FR-201.4）。 */
export function saveCollection(storage: StorageLike | null, collection: Collection): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(STORAGE_KEY, serializeCollection(collection));
    return true;
  } catch {
    return false;
  }
}
