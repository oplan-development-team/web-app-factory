// Press-and-hold input handling for the ignition zone. Unifies mouse, touch,
// and pen via Pointer Events, with a small dead-zone so natural hand tremor
// while holding doesn't cause an accidental misfire.

const DEAD_ZONE_MARGIN_PX = 14;

export interface HoldCallbacks {
  onHoldStart: () => void;
  onHoldEnd: () => void;
}

function isWithinZone(clientX: number, clientY: number, rect: DOMRect, margin: number): boolean {
  return (
    clientX >= rect.left - margin &&
    clientX <= rect.right + margin &&
    clientY >= rect.top - margin &&
    clientY <= rect.bottom + margin
  );
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
    callbacks.onHoldStart();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!holding || event.pointerId !== activePointerId) return;
    const rect = zone.getBoundingClientRect();
    if (!isWithinZone(event.clientX, event.clientY, rect, DEAD_ZONE_MARGIN_PX)) {
      endHold();
    }
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
    callbacks.onHoldStart();
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
