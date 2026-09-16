import '@fontsource/zen-old-mincho/japanese-400.css';
import '@fontsource/zen-old-mincho/latin-400.css';
import '@fontsource/zen-kaku-gothic-new/japanese-400.css';
import '@fontsource/zen-kaku-gothic-new/latin-400.css';
import './style.css';

import { detectCapability, getIosRequestPermission, readCapabilityEnv } from './lib/capability';
import { FALLBACK_MESSAGE, getHintCopy, type InputMode } from './lib/copy';
import { beginDrag, dragToTilt, type DragOrigin } from './lib/dragInput';
import { requestOrientationPermission } from './lib/permission';
import {
  createSensorWatchState,
  isValidOrientationReading,
  markValidReadingReceived,
  SENSOR_FALLBACK_TIMEOUT_MS,
  shouldFallBackToDrag,
  type SensorWatchState,
} from './lib/sensorFallback';
import { HORIZONTAL_TILT_STATE, nextTiltState, type TiltState } from './lib/tiltState';
import { SceneApp } from './scene/SceneApp';
import { createOnboarding } from './ui/onboarding';
import { showOverlayMessage } from './ui/overlayMessage';

const appRoot = document.getElementById('app');
if (!appRoot) {
  throw new Error('#app root element was not found in index.html');
}

const capability = detectCapability(readCapabilityEnv());

let sceneApp: SceneApp | null = null;
let tilt: TiltState = HORIZONTAL_TILT_STATE;
let dragOrigin: DragOrigin | null = null;
let sensorWatch: SensorWatchState | null = null;
let sensorFallbackTimerId: number | null = null;
let activeHintElement: HTMLElement | null = null;

function clearSensorFallbackTimer(): void {
  if (sensorFallbackTimerId !== null) {
    window.clearTimeout(sensorFallbackTimerId);
    sensorFallbackTimerId = null;
  }
}

function applyOrientationReading(event: DeviceOrientationEvent): void {
  if (sensorWatch && isValidOrientationReading(event.beta, event.gamma)) {
    sensorWatch = markValidReadingReceived(sensorWatch);
    clearSensorFallbackTimer();
  }
  tilt = nextTiltState(tilt, event.beta, event.gamma);
  sceneApp?.setTilt(tilt);
}

let dragTarget: HTMLElement | null = null;

function handlePointerDown(event: PointerEvent): void {
  if (!dragTarget) return;
  dragOrigin = beginDrag(event.clientX, event.clientY, tilt);
  dragTarget.setPointerCapture(event.pointerId);
}

function handlePointerMove(event: PointerEvent): void {
  if (!dragOrigin) return;
  tilt = dragToTilt(dragOrigin, event.clientX, event.clientY);
  sceneApp?.setTilt(tilt);
}

function handlePointerRelease(): void {
  dragOrigin = null;
}

function attachDragInput(target: HTMLElement): void {
  dragTarget = target;
  target.addEventListener('pointerdown', handlePointerDown);
  target.addEventListener('pointermove', handlePointerMove);
  target.addEventListener('pointerup', handlePointerRelease);
  target.addEventListener('pointercancel', handlePointerRelease);
  target.addEventListener('pointerleave', handlePointerRelease);
}

function detachDragInput(): void {
  if (!dragTarget) return;
  dragTarget.removeEventListener('pointerdown', handlePointerDown);
  dragTarget.removeEventListener('pointermove', handlePointerMove);
  dragTarget.removeEventListener('pointerup', handlePointerRelease);
  dragTarget.removeEventListener('pointercancel', handlePointerRelease);
  dragTarget.removeEventListener('pointerleave', handlePointerRelease);
  dragTarget = null;
}

function showHint(mode: InputMode): void {
  activeHintElement?.remove();
  activeHintElement = showOverlayMessage(appRoot as HTMLElement, getHintCopy(mode));
}

/**
 * Some desktop browsers pass FR-6's static feature detection (a) or (b) but
 * never actually deliver a deviceorientation reading — e.g. desktop Chrome
 * resolves requestPermission() to "granted" without a real sensor, and
 * desktop Firefox reports 'ondeviceorientation' in window as true with no
 * hardware behind it. If no valid reading arrives within the timeout, fall
 * back to drag input at runtime instead of leaving the water frozen (FR-16).
 */
function switchToDragFallback(): void {
  window.removeEventListener('deviceorientation', applyOrientationReading);
  sensorWatch = null;
  clearSensorFallbackTimer();
  attachDragInput(appRoot as HTMLElement);
  showHint('drag');
}

function startTiltInput(): void {
  window.addEventListener('deviceorientation', applyOrientationReading);
  sensorWatch = createSensorWatchState(Date.now());
  sensorFallbackTimerId = window.setTimeout(() => {
    if (sensorWatch && shouldFallBackToDrag(sensorWatch, Date.now())) {
      switchToDragFallback();
    }
  }, SENSOR_FALLBACK_TIMEOUT_MS);
}

function bootScene(mode: InputMode): void {
  sceneApp = new SceneApp(appRoot as HTMLElement);
  sceneApp.start();

  if (mode === 'tilt') {
    startTiltInput();
  } else {
    attachDragInput(appRoot as HTMLElement);
  }

  showHint(mode);
}

async function handleStart(): Promise<void> {
  // Guards against a second click firing another requestPermission() call
  // (or another boot) while the first one is still in flight.
  onboarding.setPending(true);

  if (capability === 'ios-permission') {
    const requestPermission = getIosRequestPermission();
    const outcome = requestPermission
      ? await requestOrientationPermission(requestPermission)
      : 'denied';

    onboarding.dismiss();

    if (outcome === 'granted') {
      bootScene('tilt');
    } else {
      showOverlayMessage(appRoot as HTMLElement, FALLBACK_MESSAGE, {
        variant: 'notice',
        onDone: () => bootScene('drag'),
      });
    }
    return;
  }

  onboarding.dismiss();
  bootScene(capability === 'sensor' ? 'tilt' : 'drag');
}

function teardown(): void {
  clearSensorFallbackTimer();
  window.removeEventListener('deviceorientation', applyOrientationReading);
  detachDragInput();
  sceneApp?.dispose();
  sceneApp = null;
}
window.addEventListener('pagehide', teardown);

const onboarding = createOnboarding(capability, () => {
  void handleStart();
});
appRoot.appendChild(onboarding.element);
