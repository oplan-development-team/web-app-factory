export type LockPipState = 'locked' | 'current' | 'open';

/** Small instrument-panel style progress dial: one lock pip per puzzle. */
export class LockDial {
  private pips: HTMLElement[] = [];

  constructor(container: HTMLElement, count: number) {
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const pip = document.createElement('div');
      pip.className = 'lock-pip';
      pip.innerHTML = '<span class="shackle"></span><span class="body"></span>';
      container.append(pip);
      this.pips.push(pip);
    }
  }

  setState(index: number, state: LockPipState): void {
    const pip = this.pips[index];
    if (!pip) return;
    pip.classList.remove('locked', 'current', 'open');
    pip.classList.add(state);
  }
}

/** Builds a single larger lock element used in the puzzle panel's success moment. */
export function createBigLock(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'big-lock';
  el.innerHTML = '<span class="shackle"></span><span class="body"></span>';
  return el;
}
