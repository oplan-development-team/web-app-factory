export type Category = '職場' | '家族' | '友人' | '近所付き合い';

export interface Scenario {
  id: string;
  category: Category;
  icon: string;
  situation: string;
  choices: readonly [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanations: readonly [string, string, string, string];
}

export type AnswerOutcome = 'correct' | 'wrong' | 'timeout';

export interface AnsweredRecord {
  scenario: Scenario;
  chosenIndex: number | null;
  outcome: AnswerOutcome;
  remainingMs: number;
}

export interface BestRecord {
  bestScore: number;
  bestStreak: number;
}
