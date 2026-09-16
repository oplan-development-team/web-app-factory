import '@fontsource/zen-old-mincho/japanese-400.css';
import '@fontsource/zen-old-mincho/latin-400.css';
import '@fontsource/zen-kaku-gothic-new/japanese-400.css';
import '@fontsource/zen-kaku-gothic-new/latin-400.css';
import './style.css';

import { detectCapability, getIosRequestPermission, readCapabilityEnv } from './lib/capability';
import { FALLBACK_MESSAGE, getHintCopy, type InputMode } from './lib/copy';
import { beginDrag, dragToTilt, type DragOrigin } from './lib/dragInput';
import { requestOrientationPermission } from './lib/permission';
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

function applyOrientationReading(event: DeviceOrientationEvent): void {
  tilt = nextTiltState(tilt, event.beta, event.gamma);
  sceneApp?.setTilt(tilt);
}

function attachDragInput(target: HTMLElement): void {
  target.addEventListener('pointerdown', (event) => {
    dragOrigin = beginDrag(event.clientX, event.clientY, tilt);
    target.setPointerCapture(event.pointerId);
  });
  target.addEventListener('pointermove', (event) => {
    if (!dragOrigin) return;
    tilt = dragToTilt(dragOrigin, event.clientX, event.clientY);
    sceneApp?.setTilt(tilt);
  });
  const releaseDrag = (): void => {
    dragOrigin = null;
  };
  target.addEventListener('pointerup', releaseDrag);
  target.addEventListener('pointercancel', releaseDrag);
  target.addEventListener('pointerleave', releaseDrag);
}

function bootScene(mode: InputMode): void {
  sceneApp = new SceneApp(appRoot as HTMLElement);
  sceneApp.start();

  if (mode === 'tilt') {
    window.addEventListener('deviceorientation', applyOrientationReading);
  } else {
    attachDragInput(appRoot as HTMLElement);
  }

  showOverlayMessage(appRoot as HTMLElement, getHintCopy(mode));
}

async function handleStart(): Promise<void> {
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

const onboarding = createOnboarding(capability, () => {
  void handleStart();
});
appRoot.appendChild(onboarding.element);
