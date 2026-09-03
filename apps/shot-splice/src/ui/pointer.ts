export interface DragHandlers {
  readonly onStart?: (event: PointerEvent) => void;
  readonly onMove: (dx: number, dy: number, event: PointerEvent) => void;
  readonly onEnd?: (cancelled: boolean) => void;
}

/**
 * Pointer-based dragging, wired once for mouse, touch and pen.
 *
 * Pointer capture keeps the gesture attached to the element even when the
 * finger leaves it, which is the normal case on a phone where the control is
 * small and the travel is long.
 */
export function draggable(target: HTMLElement, handlers: DragHandlers): () => void {
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;

  const onDown = (event: PointerEvent) => {
    if (pointerId !== null || event.button > 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    target.setPointerCapture(event.pointerId);
    handlers.onStart?.(event);
    event.preventDefault();
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    handlers.onMove(event.clientX - startX, event.clientY - startY, event);
  };

  const finish = (event: PointerEvent, cancelled: boolean) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    handlers.onEnd?.(cancelled);
  };

  const onUp = (event: PointerEvent) => finish(event, false);
  const onCancel = (event: PointerEvent) => finish(event, true);

  target.addEventListener('pointerdown', onDown);
  target.addEventListener('pointermove', onMove);
  target.addEventListener('pointerup', onUp);
  target.addEventListener('pointercancel', onCancel);

  return () => {
    target.removeEventListener('pointerdown', onDown);
    target.removeEventListener('pointermove', onMove);
    target.removeEventListener('pointerup', onUp);
    target.removeEventListener('pointercancel', onCancel);
  };
}

export const LONG_PRESS_MS = 200;
export const LONG_PRESS_SLOP_PX = 8;

export interface LongPressDragHandlers {
  readonly onHold: () => void;
  readonly onMove: (dx: number, dy: number, event: PointerEvent) => void;
  readonly onEnd: (cancelled: boolean) => void;
}

export interface LongPressOptions {
  readonly holdMs?: number;
  readonly slopPx?: number;
  readonly setTimer?: (fn: () => void, ms: number) => number;
  readonly clearTimer?: (handle: number) => void;
}

/**
 * Drag that only engages after the pointer has been held still.
 *
 * The filmstrip scrolls horizontally, so an immediate drag would make it
 * impossible to pan: every attempt to scroll would pick a thumbnail up
 * instead. Waiting for a hold — and cancelling it if the finger travels first —
 * keeps both gestures available on the same element.
 */
export function longPressDrag(
  target: HTMLElement,
  handlers: LongPressDragHandlers,
  options: LongPressOptions = {},
): () => void {
  const holdMs = options.holdMs ?? LONG_PRESS_MS;
  const slop = options.slopPx ?? LONG_PRESS_SLOP_PX;
  const setTimer = options.setTimer ?? ((fn, ms) => window.setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((handle) => window.clearTimeout(handle));

  let pointerId: number | null = null;
  let timer: number | null = null;
  let engaged = false;
  let startX = 0;
  let startY = 0;

  const cancelTimer = () => {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  };

  const reset = (cancelled: boolean) => {
    cancelTimer();
    if (engaged) handlers.onEnd(cancelled);
    engaged = false;
    pointerId = null;
  };

  const onDown = (event: PointerEvent) => {
    if (pointerId !== null || event.button > 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    timer = setTimer(() => {
      timer = null;
      engaged = true;
      target.setPointerCapture(pointerId as number);
      handlers.onHold();
    }, holdMs);
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!engaged) {
      // Movement before the hold completes means the user is scrolling.
      if (Math.hypot(dx, dy) > slop) reset(true);
      return;
    }
    event.preventDefault();
    handlers.onMove(dx, dy, event);
  };

  const onUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    reset(false);
  };

  const onCancel = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    reset(true);
  };

  target.addEventListener('pointerdown', onDown);
  target.addEventListener('pointermove', onMove);
  target.addEventListener('pointerup', onUp);
  target.addEventListener('pointercancel', onCancel);

  return () => {
    reset(true);
    target.removeEventListener('pointerdown', onDown);
    target.removeEventListener('pointermove', onMove);
    target.removeEventListener('pointerup', onUp);
    target.removeEventListener('pointercancel', onCancel);
  };
}
