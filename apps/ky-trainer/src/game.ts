import { SCENARIOS } from './scenarios';
import type { AnswerOutcome, Scenario } from './types';

export const QUESTION_TIME_MS = 12_000;
const BASE_POINTS = 100;
const TIME_BONUS_PER_SECOND = 5;

function shuffle<T>(input: readonly T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface AnswerResult {
  outcome: AnswerOutcome;
  chosenIndex: number | null;
  correctIndex: number;
  pointsEarned: number;
  streakAfter: number;
  comboMilestone: number | null;
  scoreAfter: number;
}

export interface TierInfo {
  title: string;
  blurb: string;
}

const TIERS: readonly { minAccuracy: number; title: string; blurb: string }[] = [
  { minAccuracy: 90, title: '空気の仙人', blurb: 'もはや悟りの境地。場が凍る前に気配で察知するレベル。' },
  { minAccuracy: 70, title: '空気読みの達人', blurb: '大抵の修羅場は丸く収められる、頼れる調整役。' },
  { minAccuracy: 50, title: 'そこそこ空気読める人', blurb: '惜しい場面もあるが、平均的には場を保てるタイプ。' },
  { minAccuracy: 25, title: '空気読み見習い', blurb: '正直さが先に出てしまいがち。もう少し修行が必要。' },
  { minAccuracy: 0, title: '空気読めない大魔王', blurb: '場を凍らせる才能では右に出る者がいない。' },
];

export function tierForAccuracy(accuracyPercent: number): TierInfo {
  const hit = TIERS.find((t) => accuracyPercent >= t.minAccuracy) ?? TIERS[TIERS.length - 1];
  return { title: hit.title, blurb: hit.blurb };
}

function isComboMilestone(streak: number): boolean {
  return streak === 3 || streak === 5 || (streak > 5 && streak % 5 === 0);
}

/**
 * 1プレイ分のゲーム進行状態。DOM に一切依存しない純粋なロジック層。
 */
export class GameSession {
  private readonly order: Scenario[];
  private index = 0;

  score = 0;
  streak = 0;
  maxStreak = 0;
  correctCount = 0;
  answeredCount = 0;

  constructor() {
    this.order = shuffle(SCENARIOS);
  }

  get total(): number {
    return this.order.length;
  }

  get questionNumber(): number {
    return this.index + 1;
  }

  get current(): Scenario {
    return this.order[this.index];
  }

  get isLastQuestion(): boolean {
    return this.index >= this.order.length - 1;
  }

  get accuracyPercent(): number {
    if (this.answeredCount === 0) return 0;
    return Math.round((this.correctCount / this.answeredCount) * 100);
  }

  /** 回答を記録する。timeout の場合は chosenIndex に null を渡す。 */
  answer(chosenIndex: number | null, remainingMs: number): AnswerResult {
    const scenario = this.current;
    const isCorrect = chosenIndex !== null && chosenIndex === scenario.correctIndex;
    const outcome: AnswerOutcome = isCorrect ? 'correct' : chosenIndex === null ? 'timeout' : 'wrong';

    this.answeredCount += 1;

    let pointsEarned = 0;
    if (isCorrect) {
      const bonus = Math.round((Math.max(remainingMs, 0) / 1000) * TIME_BONUS_PER_SECOND);
      pointsEarned = BASE_POINTS + bonus;
      this.score += pointsEarned;
      this.correctCount += 1;
      this.streak += 1;
      this.maxStreak = Math.max(this.maxStreak, this.streak);
    } else {
      this.streak = 0;
    }

    const comboMilestone = isCorrect && isComboMilestone(this.streak) ? this.streak : null;

    return {
      outcome,
      chosenIndex,
      correctIndex: scenario.correctIndex,
      pointsEarned,
      streakAfter: this.streak,
      comboMilestone,
      scoreAfter: this.score,
    };
  }

  /** 次の問題に進む。まだ問題が残っていれば true。 */
  advance(): boolean {
    if (this.index >= this.order.length - 1) return false;
    this.index += 1;
    return true;
  }
}
