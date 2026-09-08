import type { Question } from './questions';

/** 判定結果のティア。2=最高一致、1=惜しい/部分一致、0=不一致 */
export type Tier = 0 | 1 | 2;

export interface JudgeResult {
  tier: Tier;
  label: string;
}

/**
 * 自由記述の正規化: 前後空白除去・全角/半角統一・カタカナ→ひらがな統一・大文字/小文字統一。
 * 辞書的な類義語判定は行わない（プロトタイプのスコープ外）。
 */
export function normalizeText(raw: string): string {
  let s = raw.trim();
  // 全角英数記号 -> 半角
  s = s.replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  // 全角スペース -> 除去、内部の空白もすべて除去（表記ゆれの吸収）
  s = s.replace(/[\s　]/g, '');
  // カタカナ -> ひらがな
  s = s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  s = s.toLowerCase();
  return s;
}

export function judgeNumber(a: number, b: number): JudgeResult {
  const diff = Math.abs(a - b);
  if (diff === 0) return { tier: 2, label: 'ドンピシャ' };
  if (diff <= 5) return { tier: 1, label: 'おしい' };
  return { tier: 0, label: 'ズレ' };
}

export function judgeText(a: string, b: string): JudgeResult {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na.length === 0 || nb.length === 0) return { tier: 0, label: '不一致' };
  if (na === nb) return { tier: 2, label: '完全一致' };
  if (na.includes(nb) || nb.includes(na)) return { tier: 1, label: '部分一致' };
  return { tier: 0, label: '不一致' };
}

export function judgeChoice(a: string, b: string): JudgeResult {
  return a === b ? { tier: 2, label: '一致' } : { tier: 0, label: '不一致' };
}

export function judgeAnswers(question: Question, answerA: string, answerB: string): JudgeResult {
  if (question.category === 'number') {
    return judgeNumber(Number(answerA), Number(answerB));
  }
  if (question.category === 'choice') {
    return judgeChoice(answerA, answerB);
  }
  return judgeText(answerA, answerB);
}
