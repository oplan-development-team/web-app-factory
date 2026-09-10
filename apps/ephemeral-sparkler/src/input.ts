// Press-and-hold input handling for the ignition zone. Unifies mouse, touch,
// and pen via Pointer Events, with a small dead-zone so natural hand tremor
// while holding doesn't cause an accidental misfire.

const DEAD_ZONE_MARGIN_PX = 14;

export interface HoldCallbacks {
  /**
   * `source` distinguishes a pointer-driven hold (can aim a counter-nudge,
   * even if it chooses not to move — see wind.ts) from a keyboard-driven
   * hold (no position to report, gets a fixed accessibility leniency).
   */
  onHoldStart: (source: 'pointer' | 'keyboard') => void;
  onHoldEnd: () => void;
  /**
   * Fired while holding via pointer, with the pointer's offset from the
   * press-zone center normalized to roughly -1..1 on each axis. Used to let
   * the player counter wind gusts by nudging against them. Never fires for
   * keyboard-driven holds (no pointer position to report).
   */
  onMove?: (offsetX: number, offsetY: number) => void;
}

function isWithinZone(clientX: number, clientY: number, rect: DOMRect, margin: number): boolean {
  return (
    clientX >= rect.left - margin &&
    clientX <= rect.right + margin &&
    clientY >= rect.top - margin &&
    clientY <= rect.bottom + margin
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function bindHoldInput(zone: HTMLElement, callbacks: HoldCallbacks): () => void {
  let activePointerId: number | null = null;
  let holding = false;

  const endHold = (): void => {
    if (!holding) return;
    holding = false;
    activePointerId = null;
    callbacks.onHoldEnd();
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (holding) return;
    event.preventDefault();
    activePointerId = event.pointerId;
    holding = true;
    zone.setPointerCapture(event.pointerId);
    callbacks.onHoldStart('pointer');
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!holding || event.pointerId !== activePointerId) return;
    const rect = zone.getBoundingClientRect();
    if (!isWithinZone(event.clientX, event.clientY, rect, DEAD_ZONE_MARGIN_PX)) {
      endHold();
      return;
    }
    if (!callbacks.onMove) return;
    const offsetX = clamp((event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2), -1, 1);
    const offsetY = clamp((event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2), -1, 1);
    callbacks.onMove(offsetX, offsetY);
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) return;
    endHold();
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) return;
    endHold();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (holding) return;
    holding = true;
    callbacks.onHoldStart('keyboard');
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (activePointerId !== null) return; // pointer-driven hold takes precedence
    endHold();
  };

  const onWindowBlur = (): void => endHold();
  const onVisibilityChange = (): void => {
    if (document.hidden) endHold();
  };

  zone.addEventListener('pointerdown', onPointerDown);
  zone.addEventListener('pointermove', onPointerMove);
  zone.addEventListener('pointerup', onPointerUp);
  zone.addEventListener('pointercancel', onPointerCancel);
  zone.addEventListener('keydown', onKeyDown);
  zone.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onWindowBlur);
  document.addEventListener('visibilitychange', onVisibilityChange);

  return function unbind(): void {
    zone.removeEventListener('pointerdown', onPointerDown);
    zone.removeEventListener('pointermove', onPointerMove);
    zone.removeEventListener('pointerup', onPointerUp);
    zone.removeEventListener('pointercancel', onPointerCancel);
    zone.removeEventListener('keydown', onKeyDown);
    zone.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onWindowBlur);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
