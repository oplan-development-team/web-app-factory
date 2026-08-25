export interface RestoreBannerOptions {
  readonly host: HTMLElement;
  readonly strokeCount: number;
  readonly onRestore: () => void;
  readonly onDiscard: () => void;
}

/**
 * Offers to bring back the previous session's artwork.
 *
 * Restoring is never automatic: silently resurrecting a drawing the user thought
 * they had finished with is more disorienting than asking (FR-011.2).
 */
export class RestoreBanner {
  private readonly element: HTMLElement;

  constructor(options: RestoreBannerOptions) {
    this.element = document.createElement("aside");
    this.element.className = "restore-banner";
    this.element.setAttribute("role", "region");
    this.element.setAttribute("aria-label", "前回の作品の復元");

    const message = document.createElement("p");
    message.className = "restore-banner__message";
    message.textContent = `前回の作品（${options.strokeCount} ストローク）が残っています。`;

    const actions = document.createElement("div");
    actions.className = "restore-banner__actions";

    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "ghost-btn ghost-btn--accent";
    restore.textContent = "復元する";
    restore.addEventListener("click", () => {
      options.onRestore();
      this.dismiss();
    });

    const discard = document.createElement("button");
    discard.type = "button";
    discard.className = "ghost-btn";
    discard.textContent = "破棄する";
    discard.addEventListener("click", () => {
      options.onDiscard();
      this.dismiss();
    });

    actions.append(restore, discard);
    this.element.append(message, actions);
    options.host.appendChild(this.element);

    // Flip to the visible state on the next tick so the enter transition runs.
    setTimeout(() => this.element.classList.add("is-visible"), 0);
    restore.focus();
  }

  dismiss(): void {
    this.element.remove();
  }
}
