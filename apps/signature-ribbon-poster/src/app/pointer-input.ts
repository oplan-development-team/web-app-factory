import { toPosterSpace } from "../core/poster";
import type { Studio } from "./studio";

/**
 * Translates pointer events on the canvas into strokes.
 *
 * Only one pointer is tracked at a time, and it is captured on pointerdown so a
 * signature that runs past the edge of the poster still joins up (FR-001.2–4).
 */
export class PointerInput {
  private activePointerId: number | null = null;

  constructor(
    private readonly element: HTMLElement,
    private readonly studio: Studio
  ) {
    element.addEventListener("pointerdown", this.handleDown);
    element.addEventListener("pointermove", this.handleMove);
    element.addEventListener("pointerup", this.handleUp);
    element.addEventListener("pointercancel", this.handleCancel);
  }

  destroy(): void {
    this.element.removeEventListener("pointerdown", this.handleDown);
    this.element.removeEventListener("pointermove", this.handleMove);
    this.element.removeEventListener("pointerup", this.handleUp);
    this.element.removeEventListener("pointercancel", this.handleCancel);
    this.activePointerId = null;
  }

  private positionOf(event: PointerEvent): { x: number; y: number } {
    return toPosterSpace(event.clientX, event.clientY, this.element.getBoundingClientRect());
  }

  private handleDown = (event: PointerEvent): void => {
    if (this.activePointerId !== null) {
      return;
    }
    this.activePointerId = event.pointerId;
    try {
      this.element.setPointerCapture(event.pointerId);
    } catch {
      // Capture is an optimisation; drawing still works without it.
    }
    this.studio.beginStroke(this.positionOf(event), event.timeStamp);
    event.preventDefault();
  };

  private handleMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }
    this.studio.extendStroke(this.positionOf(event), event.timeStamp);
    event.preventDefault();
  };

  private handleUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }
    this.release(event.pointerId);
    this.studio.finishStroke();
  };

  private handleCancel = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }
    this.release(event.pointerId);
    this.studio.finishStroke();
  };

  private release(pointerId: number): void {
    this.activePointerId = null;
    try {
      this.element.releasePointerCapture(pointerId);
    } catch {
      // Already released, e.g. because the pointer left the document.
    }
  }
}
