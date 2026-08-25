export type ToastTone = "success" | "error";

export const TOAST_DURATION_MS = 4200;
/** Matches the CSS leave transition; the node is removed once it has faded out. */
export const TOAST_LEAVE_MS = 320;

export interface ToasterOptions {
  readonly durationMs?: number;
  readonly leaveMs?: number;
}

/**
 * Transient status messages. Errors state what failed and what the user can do
 * about it, so a failure is never swallowed into the console (NFR-005.3).
 */
export class Toaster {
  private readonly durationMs: number;
  private readonly leaveMs: number;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(
    private readonly container: HTMLElement,
    options: ToasterOptions = {}
  ) {
    this.durationMs = options.durationMs ?? TOAST_DURATION_MS;
    this.leaveMs = options.leaveMs ?? TOAST_LEAVE_MS;
  }

  success(message: string): void {
    this.show(message, "success");
  }

  error(message: string): void {
    this.show(message, "error");
  }

  show(message: string, tone: ToastTone): void {
    const toast = document.createElement("output");
    toast.className = `toast toast--${tone}`;
    toast.setAttribute("role", "status");
    // Errors deserve to interrupt; successes should not.
    toast.setAttribute("aria-live", tone === "error" ? "assertive" : "polite");
    toast.textContent = message;
    this.container.appendChild(toast);

    // Let the element land in the DOM before flipping to the visible state, so
    // the enter transition actually runs.
    const enter = setTimeout(() => {
      toast.classList.add("is-visible");
      this.timers.delete(enter);
    }, 0);
    this.timers.add(enter);

    const leave = setTimeout(() => {
      toast.classList.remove("is-visible");
      this.timers.delete(leave);
      const remove = setTimeout(() => {
        toast.remove();
        this.timers.delete(remove);
      }, this.leaveMs);
      this.timers.add(remove);
    }, this.durationMs);
    this.timers.add(leave);
  }

  dispose(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.container.replaceChildren();
  }
}
