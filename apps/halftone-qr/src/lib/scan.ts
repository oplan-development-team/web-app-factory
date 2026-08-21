import type { ProtectLevel } from './types';

/**
 * スキャン条件マトリクス（SPEC FR-008.2）。
 *
 * scale = サブモジュール 1 個を何ピクセルで捉えるか（カメラとの距離に相当）。
 * blur  = そのうえで掛けるぼかし半径（ピント・手ブレ・印刷にじみに相当）。
 *
 * 小さい scale と大きい blur ほど厳しい条件になる。
 */
export interface ScanCondition {
  scale: number;
  blur: number;
}

export const SCAN_SCALES = [2, 3, 5] as const;
export const SCAN_BLURS = [0, 1, 2] as const;

export const SCAN_CONDITIONS: readonly ScanCondition[] = SCAN_SCALES.flatMap((scale) =>
  SCAN_BLURS.map((blur) => ({ scale, blur })),
);

export interface ScanTrial extends ScanCondition {
  ok: boolean;
}

export type ScanGrade = 'good' | 'fair' | 'unstable' | 'fail';

export interface ScanReport {
  trials: ScanTrial[];
  passed: number;
  total: number;
  grade: ScanGrade;
}

export const GRADE_LABELS: Record<ScanGrade, string> = {
  good: '良好',
  fair: '概ね良好',
  unstable: '不安定',
  fail: '読み取り不可',
};

export const GRADE_SUMMARIES: Record<ScanGrade, string> = {
  good: 'すべての条件でデコードできました。',
  fair: '悪条件（小さい・ぼやける）では読めないことがあります。',
  unstable: '印刷サイズや照明によっては読めません。設定の調整をおすすめします。',
  fail: 'どの条件でもデコードできませんでした。設定の見直しが必要です。',
};

export function gradeFor(passed: number, total: number): ScanGrade {
  if (total <= 0 || passed <= 0) return 'fail';
  if (passed >= total) return 'good';
  if (passed / total >= 2 / 3) return 'fair';
  return 'unstable';
}

export function buildReport(trials: ScanTrial[]): ScanReport {
  const passed = trials.filter((trial) => trial.ok).length;
  return { trials, passed, total: trials.length, grade: gradeFor(passed, trials.length) };
}

export interface AdviceInput {
  grade: ScanGrade;
  qrness: number;
  protect: ProtectLevel;
  contrast: number;
}

/**
 * 改善のための助言を組み立てる（SPEC FR-008.7）。
 * 効果が大きい順に並べ、すでに上限の項目は出さない。
 */
export function adviceFor({ grade, qrness, protect, contrast }: AdviceInput): string[] {
  if (grade === 'good') return [];

  const advice: string[] = [];
  if (qrness < 0.9) {
    advice.push('「QR らしさ」を上げると、画像の再現度と引き換えに読み取りが安定します。');
  }
  if (protect !== 'all') {
    advice.push(
      protect === 'none'
        ? '機能パターンの保護を「標準」以上にすると、位置検出が安定します。'
        : '機能パターンの保護を「最大」にすると、形式情報も元のまま残ります。',
    );
  }
  if (contrast > 0) {
    advice.push('画像のコントラストを下げると、黒く潰れた領域が減って読みやすくなります。');
  }
  if (grade === 'fail' || grade === 'unstable') {
    advice.push('エンコードするテキストを短くすると、モジュールが粗くなり読みやすくなります。');
  }
  return advice;
}

/* --- Worker とのメッセージ --- */

export interface ScanRequest {
  id: number;
  grid: Uint8Array;
  moduleCount: number;
  text: string;
}

export type ScanResponse =
  | { id: number; ok: true; trials: ScanTrial[] }
  | { id: number; ok: false; message: string };
