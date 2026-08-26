import type { Dome } from '../globe/dome';

const SHAKE_THRESHOLD = 13; // m/s^2 delta between consecutive readings
const SHAKE_COOLDOWN = 150; // ms

type PermissionCapableDeviceMotionEvent = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export function bindDeviceMotionShake(
  rig: HTMLElement,
  dome: Dome,
  permissionBtn: HTMLButtonElement,
  statusEl: HTMLElement,
): void {
  let prev: { x: number; y: number; z: number } | null = null;
  let lastShakeAt = 0;

  const onMotion = (ev: DeviceMotionEvent) => {
    const acc = ev.accelerationIncludingGravity ?? ev.acceleration;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;
    const cur = { x: acc.x, y: acc.y, z: acc.z };
    if (prev) {
      const delta = Math.hypot(cur.x - prev.x, cur.y - prev.y, cur.z - prev.z);
      const now = performance.now();
      if (delta > SHAKE_THRESHOLD && now - lastShakeAt > SHAKE_COOLDOWN) {
        lastShakeAt = now;
        const dirX = Math.max(-1, Math.min(1, (cur.x - prev.x) / 10));
        const dirY = Math.max(-1, Math.min(1, -(cur.y - prev.y) / 10));
        dome.applyImpulse(dirX, dirY, Math.min(2.2, delta / 22));
        rig.classList.remove('is-shaking');
        void rig.offsetWidth;
        rig.classList.add('is-shaking');
      }
    }
    prev = cur;
  };

  const enable = () => {
    window.addEventListener('devicemotion', onMotion);
    statusEl.textContent = '端末を振ってみてください。';
  };

  const supportsMotion = typeof window.DeviceMotionEvent !== 'undefined';
  const gated = supportsMotion && typeof (DeviceMotionEvent as PermissionCapableDeviceMotionEvent).requestPermission === 'function';

  if (!supportsMotion) {
    statusEl.textContent = '';
    return;
  }

  if (gated) {
    permissionBtn.hidden = false;
    permissionBtn.addEventListener('click', async () => {
      try {
        const result = await (DeviceMotionEvent as PermissionCapableDeviceMotionEvent).requestPermission!();
        if (result === 'granted') {
          permissionBtn.hidden = true;
          enable();
        } else {
          statusEl.textContent = 'センサーの利用が許可されませんでした。タップやドラッグでも揺らせます。';
        }
      } catch {
        statusEl.textContent = 'センサーを有効にできませんでした。タップやドラッグでも揺らせます。';
      }
    });
  } else {
    enable();
  }
}
