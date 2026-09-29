import { buildLayout, BOARD_WIDTH_U } from './data/keyboard';
import type { KeyDef, LayoutId } from './types';

export type KeyActivateSource = 'physical' | 'click';

export interface KeyboardCallbacks {
  onActivate: (code: string, source: KeyActivateSource) => void;
  onDeactivatePhysical: (code: string) => void;
}

/** Renders the on-screen keyboard from the coordinate data table, and
 * dispatches physical (keydown/keyup) + pointer input through the same
 * judgment path via `callbacks`. */
export class KeyboardView {
  private container: HTMLElement;
  private callbacks: KeyboardCallbacks;
  private elements = new Map<string, HTMLButtonElement>();
  private layout: LayoutId = 'us';
  private heldDownByClick = new Set<string>();

  constructor(container: HTMLElement, callbacks: KeyboardCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    window.addEventListener('keydown', this.handlePhysicalKeyDown);
    window.addEventListener('keyup', this.handlePhysicalKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
  }

  setLayout(layout: LayoutId): void {
    this.layout = layout;
    this.render();
  }

  private handlePhysicalKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (!this.elements.has(e.code)) return;
    // Prevent default browser behavior (Space scroll, Tab focus-move, etc.)
    // for every key this board renders, since they're all part of the game.
    e.preventDefault();
    this.callbacks.onActivate(e.code, 'physical');
  };

  private handlePhysicalKeyUp = (e: KeyboardEvent): void => {
    if (!this.elements.has(e.code)) return;
    this.callbacks.onDeactivatePhysical(e.code);
  };

  private handleWindowBlur = (): void => {
    // Losing focus can strand "held" physical keys; release everything.
    for (const code of this.elements.keys()) {
      this.callbacks.onDeactivatePhysical(code);
    }
  };

  render(): void {
    this.container.innerHTML = '';
    this.elements.clear();
    const keys = buildLayout(this.layout);
    this.container.style.setProperty('--board-width-u', String(BOARD_WIDTH_U));

    for (const key of keys) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'keycap' + (key.structural ? ' keycap-structural' : ' keycap-live');
      btn.dataset.code = key.code;
      const quarter = 0.25;
      const startCol = Math.round(key.col / quarter) + 1;
      const widthCols = Math.round((key.width ?? 1) / quarter);
      btn.style.gridColumn = `${startCol} / span ${widthCols}`;
      btn.style.gridRow = `${key.row + 1}`;

      const label = document.createElement('span');
      label.className = 'keycap-label';
      label.textContent = key.label;
      btn.append(label);

      if (key.subLabel) {
        const sub = document.createElement('span');
        sub.className = 'keycap-sublabel';
        sub.textContent = key.subLabel;
        btn.append(sub);
      }

      btn.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        this.heldDownByClick.add(key.code);
        this.setPressedVisual(key.code, true);
        this.callbacks.onActivate(key.code, 'click');
      });
      const release = () => {
        if (this.heldDownByClick.has(key.code)) {
          this.heldDownByClick.delete(key.code);
          this.setPressedVisual(key.code, false);
        }
      };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('pointercancel', release);

      this.elements.set(key.code, btn);
      this.container.append(btn);
    }
  }

  private setPressedVisual(code: string, pressed: boolean): void {
    this.elements.get(code)?.classList.toggle('is-pressed', pressed);
  }

  /** Reflect whether a code currently participates in the "active set" for a simultaneous puzzle. */
  setEngaged(code: string, engaged: boolean): void {
    this.elements.get(code)?.classList.toggle('is-engaged', engaged);
  }

  markCorrectStep(code: string, order: number): void {
    const el = this.elements.get(code);
    if (!el) return;
    el.classList.add('is-correct-step');
    el.dataset.stepOrder = String(order);
  }

  flashError(code: string): void {
    const el = this.elements.get(code);
    if (!el) return;
    el.classList.remove('is-error');
    // Force reflow so the animation can retrigger on repeated errors.
    void el.offsetWidth;
    el.classList.add('is-error');
    el.addEventListener('animationend', () => el.classList.remove('is-error'), { once: true });
  }

  flashSuccess(codes: string[]): void {
    for (const code of codes) {
      const el = this.elements.get(code);
      if (!el) continue;
      el.classList.add('is-solved-flash');
      el.addEventListener('animationend', () => el.classList.remove('is-solved-flash'), { once: true });
    }
  }

  /** Clears just the "correct so far" trace markers, e.g. when a sequence puzzle restarts after a wrong key. */
  clearCorrectSteps(): void {
    for (const el of this.elements.values()) {
      el.classList.remove('is-correct-step');
      delete el.dataset.stepOrder;
    }
  }

  /** Clears all transient per-puzzle visual state (used on reset / layout switch / new puzzle). */
  clearPuzzleState(): void {
    for (const el of this.elements.values()) {
      el.classList.remove('is-engaged', 'is-correct-step', 'is-error', 'is-hint', 'is-solved-flash', 'is-pressed');
      delete el.dataset.stepOrder;
      delete el.dataset.hintOrder;
    }
    this.heldDownByClick.clear();
  }

  showHint(codes: string[], ordered: boolean): void {
    codes.forEach((code, i) => {
      const el = this.elements.get(code);
      if (!el) return;
      el.classList.add('is-hint');
      if (ordered) el.dataset.hintOrder = String(i + 1);
    });
  }

  hideHint(): void {
    for (const el of this.elements.values()) {
      el.classList.remove('is-hint');
      delete el.dataset.hintOrder;
    }
  }

  getKeyDefsForLayout(): KeyDef[] {
    return buildLayout(this.layout);
  }
}
