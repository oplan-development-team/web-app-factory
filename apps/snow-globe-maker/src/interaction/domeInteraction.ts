import type { Dome } from '../globe/dome';

const TAP_MOVE_THRESHOLD = 8;
const TAP_TIME_THRESHOLD = 320;
const MAX_TILT_DEG = 11;
const MAX_TILT_PX = 12;

interface Sample {
  x: number;
  y: number;
  t: number;
}

/**
 * Handles both desktop pointer-drag "shake" gestures and the tap fallback,
 * plus the CSS tilt feedback on the dome rig element.
 */
export function bindDomeInteraction(rig: HTMLElement, dome: Dome, hint: HTMLElement): void {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startT = 0;
  let last: Sample | null = null;
  let cumX = 0;
  let cumY = 0;
  let lastImpulseAt = 0;

  const setTilt = (dx: number, dy: number, animated: boolean) => {
    rig.style.transition = animated ? 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
    const rot = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, dx * 0.06));
    const tx = Math.max(-MAX_TILT_PX, Math.min(MAX_TILT_PX, dx * 0.05));
    const ty = Math.max(-MAX_TILT_PX, Math.min(MAX_TILT_PX, dy * 0.03));
    rig.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
  };

  const onDown = (ev: PointerEvent) => {
    dragging = true;
    startX = ev.clientX;
    startY = ev.clientY;
    startT = performance.now();
    last = { x: ev.clientX, y: ev.clientY, t: startT };
    cumX = 0;
    cumY = 0;
    rig.setPointerCapture(ev.pointerId);
    hint.classList.add('is-hidden');
  };

  const onMove = (ev: PointerEvent) => {
    if (!dragging || !last) return;
    const now = performance.now();
    const dt = Math.max(4, now - last.t);
    const vx = ((ev.clientX - last.x) / dt) * 1000;
    const vy = ((ev.clientY - last.y) / dt) * 1000;
    cumX = ev.clientX - startX;
    cumY = ev.clientY - startY;
    setTilt(cumX, cumY, false);

    const speed = Math.hypot(vx, vy);
    if (speed > 90 && now - lastImpulseAt > 45) {
      lastImpulseAt = now;
      const dirX = vx / (speed || 1);
      const dirY = vy / (speed || 1);
      dome.applyImpulse(dirX, dirY, Math.min(2, speed / 700));
    }
    last = { x: ev.clientX, y: ev.clientY, t: now };
  };

  const onUp = (ev: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    const duration = performance.now() - startT;
    const distance = Math.hypot(ev.clientX - startX, ev.clientY - startY);
    if (distance < TAP_MOVE_THRESHOLD && duration < TAP_TIME_THRESHOLD) {
      const angle = Math.random() * Math.PI * 2;
      dome.applyImpulse(Math.cos(angle), Math.sin(angle) - 0.4, 0.5);
      rig.classList.remove('is-tapped');
      // restart the tap animation
      void rig.offsetWidth;
      rig.classList.add('is-tapped');
    }
    setTilt(0, 0, true);
    last = null;
  };

  rig.addEventListener('pointerdown', onDown);
  rig.addEventListener('pointermove', onMove);
  rig.addEventListener('pointerup', onUp);
  rig.addEventListener('pointercancel', onUp);
}
