import { pickNextQuestion, type Question } from './questions';
import { judgeAnswers, type JudgeResult } from './judge';
import { applyScore } from './score';
import { loadRecords, maybeUpdateRecords, type Records } from './storage';

export type Screen = 'title' | 'prompt' | 'input' | 'handoff' | 'countdown' | 'reveal';

export interface HistoryEntry {
  roundNumber: number;
  question: Question;
  answerP1: string;
  answerP2: string;
  judge: JudgeResult;
  roundScore: number;
}

export interface RevealResult {
  judge: JudgeResult;
  roundScore: number;
  multiplier: number;
  newStreak: number;
  streakBroken: boolean;
}

export interface GameState {
  screen: Screen;
  question: Question | null;
  activePlayer: 1 | 2;
  handoffTo: 1 | 2;
  answerP1: string | null;
  answerP2: string | null;
  roundNumber: number;
  score: number;
  streak: number;
  history: HistoryEntry[];
  recentQuestionIds: string[];
  lastResult: RevealResult | null;
  records: Records;
  justUpdatedBest: { score: boolean; streak: boolean };
}

export type Event =
  | { type: 'START_ROUND' }
  | { type: 'BEGIN_INPUT' }
  | { type: 'SUBMIT_P1'; answer: string }
  | { type: 'CONFIRM_HANDOFF' }
  | { type: 'SUBMIT_P2'; answer: string }
  | { type: 'COUNTDOWN_DONE' }
  | { type: 'NEXT_ROUND' }
  | { type: 'RESET' };

const RECENT_LIMIT = 8;
const HISTORY_LIMIT = 12;

export function createInitialState(): GameState {
  return {
    screen: 'title',
    question: null,
    activePlayer: 1,
    handoffTo: 2,
    answerP1: null,
    answerP2: null,
    roundNumber: 0,
    score: 0,
    streak: 0,
    history: [],
    recentQuestionIds: [],
    lastResult: null,
    records: loadRecords(),
    justUpdatedBest: { score: false, streak: false },
  };
}

export function reduce(state: GameState, event: Event): GameState {
  switch (event.type) {
    case 'START_ROUND': {
      const question = pickNextQuestion(state.recentQuestionIds);
      const recentQuestionIds = [question.id, ...state.recentQuestionIds].slice(0, RECENT_LIMIT);
      return {
        ...state,
        screen: 'prompt',
        question,
        recentQuestionIds,
        roundNumber: state.roundNumber + 1,
        activePlayer: 1,
        answerP1: null,
        answerP2: null,
        lastResult: null,
      };
    }

    case 'BEGIN_INPUT': {
      return {
        ...state,
        screen: 'input',
        activePlayer: 1,
      };
    }

    case 'SUBMIT_P1': {
      return {
        ...state,
        screen: 'handoff',
        handoffTo: 2,
        answerP1: event.answer,
      };
    }

    case 'CONFIRM_HANDOFF': {
      return {
        ...state,
        screen: 'input',
        activePlayer: state.handoffTo,
      };
    }

    case 'SUBMIT_P2': {
      return {
        ...state,
        screen: 'countdown',
        answerP2: event.answer,
      };
    }

    case 'COUNTDOWN_DONE': {
      if (!state.question || state.answerP1 === null || state.answerP2 === null) {
        return state;
      }
      const judge = judgeAnswers(state.question, state.answerP1, state.answerP2);
      const outcome = applyScore(state.streak, judge.tier);
      const streakBroken = state.streak > 0 && outcome.nextStreak === 0 && judge.tier === 0;
      const newScore = state.score + outcome.roundScore;

      const historyEntry: HistoryEntry = {
        roundNumber: state.roundNumber,
        question: state.question,
        answerP1: state.answerP1,
        answerP2: state.answerP2,
        judge,
        roundScore: outcome.roundScore,
      };
      const history = [historyEntry, ...state.history].slice(0, HISTORY_LIMIT);

      const { scoreUpdated, streakUpdated, records } = maybeUpdateRecords(newScore, outcome.nextStreak);

      return {
        ...state,
        screen: 'reveal',
        score: newScore,
        streak: outcome.nextStreak,
        history,
        records,
        justUpdatedBest: { score: scoreUpdated, streak: streakUpdated },
        lastResult: {
          judge,
          roundScore: outcome.roundScore,
          multiplier: outcome.multiplier,
          newStreak: outcome.nextStreak,
          streakBroken,
        },
      };
    }

    case 'NEXT_ROUND': {
      return reduce(state, { type: 'START_ROUND' });
    }

    case 'RESET': {
      const fresh = createInitialState();
      return { ...fresh, records: state.records };
    }

    default:
      return state;
  }
}
