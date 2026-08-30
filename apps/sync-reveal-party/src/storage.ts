const KEY = 'sync-reveal-party:records:v1';

export interface Records {
  bestScore: number;
  bestStreak: number;
}

const DEFAULT_RECORDS: Records = { bestScore: 0, bestStreak: 0 };

export function loadRecords(): Records {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_RECORDS };
    const parsed = JSON.parse(raw) as Partial<Records>;
    return {
      bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : 0,
      bestStreak: typeof parsed.bestStreak === 'number' ? parsed.bestStreak : 0,
    };
  } catch {
    return { ...DEFAULT_RECORDS };
  }
}

/** 現在値がベストを超えていれば保存し、更新の有無を返す。 */
export function maybeUpdateRecords(score: number, streak: number): { scoreUpdated: boolean; streakUpdated: boolean; records: Records } {
  const current = loadRecords();
  const scoreUpdated = score > current.bestScore;
  const streakUpdated = streak > current.bestStreak;
  const records: Records = {
    bestScore: scoreUpdated ? score : current.bestScore,
    bestStreak: streakUpdated ? streak : current.bestStreak,
  };
  if (scoreUpdated || streakUpdated) {
    try {
      localStorage.setItem(KEY, JSON.stringify(records));
    } catch {
      // localStorage が使えない環境ではベスト記録の保存を諦める(プロトタイプの割り切り)
    }
  }
  return { scoreUpdated, streakUpdated, records };
}
