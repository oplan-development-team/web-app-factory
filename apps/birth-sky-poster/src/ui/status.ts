export type StatusTone = 'info' | 'success' | 'error';

/**
 * A single live region for transient feedback: geolocation results, export
 * progress, export failures.
 *
 * The prototype used `window.alert` for export errors, which blocks the page,
 * cannot be styled, and is invisible to anything reading the document. Routing
 * everything through one live region keeps the feedback in the page and makes
 * it announceable (FR-008.6, FR-010.2).
 */
export class StatusRegion {
  readonly #el: HTMLElement;

  constructor(el: HTMLElement) {
    this.#el = el;
    this.clear();
  }

  set(message: string, tone: StatusTone = 'info'): void {
    this.#el.textContent = message;
    this.#el.dataset['tone'] = tone;
    // Errors interrupt; progress and confirmations wait for a pause.
    this.#el.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    this.#el.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
    this.#el.hidden = false;
  }

  clear(): void {
    this.#el.textContent = '';
    delete this.#el.dataset['tone'];
    this.#el.setAttribute('role', 'status');
    this.#el.setAttribute('aria-live', 'polite');
    this.#el.hidden = true;
  }

  get message(): string {
    return this.#el.textContent ?? '';
  }

  get tone(): StatusTone | undefined {
    return this.#el.dataset['tone'] as StatusTone | undefined;
  }
}
