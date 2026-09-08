import { formatDuration, formatGlimmer, formatRate } from '../domain/format';
import { must, replayAnimation, setText } from './dom';

export interface StatsState {
  readonly balance: number;
  readonly tabCount: number;
  readonly longestLabel: string;
  readonly longestMs: number;
  readonly ratePerSecond: number;
}

export class StatsPanel {
  private readonly glimmer = must<HTMLElement>('#glimmer-value');
  private readonly tabCount = must<HTMLElement>('#tab-count');
  private readonly longest = must<HTMLElement>('#longest-note');
  private readonly rate = must<HTMLElement>('#rate-note');

  render(state: StatsState): void {
    setText(this.glimmer, formatGlimmer(state.balance));
    setText(this.tabCount, String(Math.max(0, state.tabCount)));
    setText(this.longest, `最長放置 ${formatDuration(state.longestMs)} / ${state.longestLabel}`);
    setText(this.rate, formatRate(state.ratePerSecond));
  }

  /** Confirms a purchase on the number that changed. */
  flashBalance(): void {
    replayAnimation(this.glimmer, 'readout__value--flash');
  }
}
