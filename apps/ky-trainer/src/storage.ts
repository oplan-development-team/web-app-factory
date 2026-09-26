import type { BestRecord } from './types';

const STORAGE_KEY = 'ky-trainer:best-record:v1';

/**
 * localStorage が使えない環境(プライベートモード等)でも例外を投げないための
 * 薄いラッパー。取得できなければ null / 何もしないを返す。
 */
function isStorageAvailable(): boolean {
  try {
    const testKey = '__ky_trainer_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function loadBestRecord(): BestRecord | null {
  if (!isStorageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.bestScore === 'number' &&
      typeof parsed.bestStreak === 'number' &&
      Number.isFinite(parsed.bestScore) &&
      Number.isFinite(parsed.bestStreak)
    ) {
      return { bestScore: parsed.bestScore, bestStreak: parsed.bestStreak };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 既存記録と比較し、スコア・ストリークそれぞれで上回った値のみ更新して保存する。
 * 戻り値は保存後の最新記録(保存に失敗した場合は比較結果のみのメモリ上の値)。
 */
export function saveBestRecordIfBetter(score: number, streak: number): BestRecord {
  const current = loadBestRecord();
  const next: BestRecord = {
    bestScore: Math.max(current?.bestScore ?? 0, score),
    bestStreak: Math.max(current?.bestStreak ?? 0, streak),
  };
  if (isStorageAvailable()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 保存できなくてもゲーム進行は継続する
    }
  }
  return next;
}
