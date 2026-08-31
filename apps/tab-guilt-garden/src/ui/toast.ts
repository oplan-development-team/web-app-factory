import { achievementById } from '../domain/achievements';

/** How long a stamp stays on screen before it slides away. */
const TOAST_LIFETIME_MS = 5200;

/**
 * One-shot notifications for newly unlocked achievements.
 *
 * The engine already guarantees an id is reported only on the tick it is first
 * satisfied, so this layer does no deduplication of its own beyond ignoring
 * unknown ids.
 */
export class ToastHost {
  constructor(
    private el: HTMLElement,
    private schedule: (fn: () => void, ms: number) => void = (fn, ms) => {
      setTimeout(fn, ms);
    },
  ) {}

  announce(ids: string[]): void {
    for (const id of ids) {
      const achievement = achievementById(id);
      if (!achievement) continue;
      this.push(achievement.label, achievement.requirement);
    }
  }

  private push(label: string, requirement: string): void {
    const toast = document.createElement('div');
    toast.className = 'toast';
    // status (not alert) so screen readers announce it without interrupting.
    toast.setAttribute('role', 'status');

    const eyebrow = document.createElement('p');
    eyebrow.className = 'toast-eyebrow mono';
    eyebrow.textContent = '実績解除';

    const title = document.createElement('p');
    title.className = 'toast-title';
    title.textContent = label;

    const body = document.createElement('p');
    body.className = 'toast-body';
    body.textContent = requirement;

    toast.append(eyebrow, title, body);
    this.el.appendChild(toast);

    this.schedule(() => {
      toast.dataset.leaving = 'true';
      this.schedule(() => toast.remove(), 400);
    }, TOAST_LIFETIME_MS);
  }
}
