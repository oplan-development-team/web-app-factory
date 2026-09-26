import './style.css';
import { GameSession } from './game';
import { loadBestRecord, saveBestRecordIfBetter } from './storage';
import { renderFinalScreen, renderQuestionScreen, renderResultScreen, renderStartScreen, type ScreenCleanup } from './screens';
import type { AnswerOutcome } from './types';

class App {
  private cleanup: ScreenCleanup | null = null;
  private session: GameSession | null = null;

  constructor(private readonly root: HTMLElement) {
    this.showStart();
  }

  private setScreen(render: () => ScreenCleanup): void {
    this.cleanup?.();
    this.cleanup = render();
  }

  private showStart(): void {
    this.setScreen(() =>
      renderStartScreen(this.root, loadBestRecord(), () => this.startGame()),
    );
  }

  private startGame(): void {
    this.session = new GameSession();
    this.showQuestion();
  }

  private showQuestion(): void {
    const session = this.session;
    if (!session) return;
    this.setScreen(() =>
      renderQuestionScreen(
        this.root,
        session.current,
        session.questionNumber,
        session.total,
        session.streak,
        (chosenIndex, remainingMs, _outcome: AnswerOutcome) => this.handleAnswer(chosenIndex, remainingMs),
      ),
    );
  }

  private handleAnswer(chosenIndex: number | null, remainingMs: number): void {
    const session = this.session;
    if (!session) return;
    const scenario = session.current;
    const result = session.answer(chosenIndex, remainingMs);
    this.setScreen(() =>
      renderResultScreen(this.root, scenario, chosenIndex, result, () => this.proceed()),
    );
  }

  private proceed(): void {
    const session = this.session;
    if (!session) return;
    if (session.advance()) {
      this.showQuestion();
    } else {
      this.showFinal();
    }
  }

  private showFinal(): void {
    const session = this.session;
    if (!session) return;
    const previousBest = loadBestRecord();
    const bestRecord = saveBestRecordIfBetter(session.score, session.maxStreak);
    this.setScreen(() =>
      renderFinalScreen(this.root, session, bestRecord, previousBest, () => this.showStart()),
    );
  }
}

const rootEl = document.getElementById('app');
if (!rootEl) {
  throw new Error('#app root element not found');
}
new App(rootEl);
