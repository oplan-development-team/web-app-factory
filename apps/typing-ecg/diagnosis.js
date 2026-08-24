// diagnosis.js
// Pure statistics + joke-diagnosis lookup. Operates only on numeric
// keydown intervals (ms) — never on the typed characters themselves.

export const MIN_KEYSTROKES_FOR_DIAGNOSIS = 20;
export const AUTO_DIAGNOSE_IDLE_MS = 1500;

/**
 * @param {number[]} intervals ms between consecutive keydowns
 */
export function computeStats(intervals) {
  const n = intervals.length;
  if (n === 0) {
    return { mean: 0, stdDev: 0, cv: 0, n: 0 };
  }
  const mean = intervals.reduce((a, b) => a + b, 0) / n;
  const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;
  return { mean, stdDev, cv, n };
}

function speedCategory(meanIntervalMs) {
  if (meanIntervalMs <= 130) return "fast";
  if (meanIntervalMs <= 260) return "normal";
  return "slow";
}

function regularityCategory(cv) {
  return cv < 0.4 ? "stable" : "unstable";
}

const DIAGNOSIS_TABLE = {
  "stable/fast": {
    name: "俊敏安定型（スプリンター脈）",
    comment:
      "速く、かつ乱れがほぼ無い理想的な打鍵リズム。指先がメトロノーム化しています。タイピング検定官も裸足で逃げ出すペースです。",
  },
  "stable/normal": {
    name: "標準安定型（健康優良キー）",
    comment:
      "速すぎず遅すぎず、リズムも安定。健康診断なら「A判定」の優等生タイプです。この調子で長文もいけます。",
  },
  "stable/slow": {
    name: "徐脈のんびり型（瞑想タイパー）",
    comment:
      "一打一打が丁寧でブレが少ないマイペース型。焦らず、着実に。禅の境地でキーボードに向かっています。",
  },
  "unstable/fast": {
    name: "頻脈スピードタイパー型（暴走特急）",
    comment:
      "とにかく速いがリズムは荒ぶり気味。変換ミス多発の予感がしつつも勢いだけで押し切る猛者タイプです。",
  },
  "unstable/normal": {
    name: "不整脈型（気まぐれリズム）",
    comment:
      "速度は平均的ながら、間隔の揺れが大きめ。考え事をしながら打っている、あるいは急に閃きが降りてくるタイプかもしれません。",
  },
  "unstable/slow": {
    name: "低電位ためらい型（思案顔タイパー）",
    comment:
      "打鍵は控えめでリズムも一定しない、思案しながら打つ慎重派。次の一文字を選ぶ時間も味のうちです。",
  },
};

/**
 * @param {number[]} intervals
 * @returns {{name: string, comment: string, mean: number, stdDev: number, cv: number, n: number} | null}
 */
export function diagnose(intervals) {
  if (intervals.length < MIN_KEYSTROKES_FOR_DIAGNOSIS - 1) return null;
  const stats = computeStats(intervals);
  const speed = speedCategory(stats.mean);
  const regularity = regularityCategory(stats.cv);
  const key = `${regularity}/${speed}`;
  const entry = DIAGNOSIS_TABLE[key] || DIAGNOSIS_TABLE["stable/normal"];
  return { ...entry, ...stats, speed, regularity };
}
