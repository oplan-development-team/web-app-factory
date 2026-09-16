/**
 * Orchestrates the renderer, camera, lights, water, floaters and
 * post-processing into a running render loop. This class is deliberately
 * not unit-tested (WebGL/rendering is out of scope for Vitest here — see
 * the implementation report); its job is to wire together the pure,
 * tested logic in src/lib with three.js objects.
 */
import * as THREE from 'three';
import { HORIZONTAL_TILT_STATE, type TiltState } from '../lib/tiltState';
import { bakeEnvironmentMap, createSkyMesh, SUN_COLOR, SUN_DIRECTION } from './environment';
import { createFloaters, type FloatersHandle } from './floaters';
import { createComposer, type ComposerHandle } from './postFX';
import { createWater, type WaterHandle } from './water';

const MAX_PIXEL_RATIO = 1.75;
const MAX_DELTA_SECONDS = 0.1;

export class SceneApp {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly composer: ComposerHandle;
  private readonly water: WaterHandle;
  private readonly floaters: FloatersHandle;
  private readonly timer: THREE.Timer;
  private readonly envMap: THREE.Texture;

  private tilt: TiltState = HORIZONTAL_TILT_STATE;
  private frameId: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.classList.add('scene-canvas');
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.envMap = bakeEnvironmentMap(this.renderer);
    this.scene.environment = this.envMap;
    this.scene.add(createSkyMesh());

    // far must exceed the sky dome radius (createSkyMesh default: 500) or the
    // dome gets clipped and the sky renders as black emptiness (FR-3).
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 600);
    this.camera.position.set(0, 4.6, 6.6);
    this.camera.lookAt(0, 0, 0);

    const sunLight = new THREE.DirectionalLight(SUN_COLOR, 1.7);
    sunLight.position.copy(SUN_DIRECTION).multiplyScalar(20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 40;
    sunLight.shadow.camera.left = -8;
    sunLight.shadow.camera.right = 8;
    sunLight.shadow.camera.top = 8;
    sunLight.shadow.camera.bottom = -8;
    sunLight.shadow.radius = 3;
    sunLight.shadow.blurSamples = 16;
    // Avoids shadow acne (banding) on the large, mostly-flat water plane.
    sunLight.shadow.bias = -0.0015;
    sunLight.shadow.normalBias = 0.02;
    this.scene.add(sunLight);
    this.scene.add(new THREE.AmbientLight(0xdfe9e6, 0.4));

    this.water = createWater(this.envMap);
    this.scene.add(this.water.mesh);

    this.floaters = createFloaters();
    this.scene.add(this.floaters.group);

    this.composer = createComposer(this.renderer, this.scene, this.camera, width, height);
    this.timer = new THREE.Timer();
    this.timer.connect(document);

    window.addEventListener('resize', this.handleResize);
  }

  private readonly handleResize = (): void => {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  };

  /** Feeds the latest tilt reading (degrees, already clamped/NaN-safe) into the scene. */
  setTilt(tilt: TiltState): void {
    this.tilt = tilt;
  }

  start(): void {
    const loop = (timestamp: number): void => {
      this.timer.update(timestamp);
      const dt = Math.min(this.timer.getDelta(), MAX_DELTA_SECONDS);
      const elapsed = this.timer.getElapsed();
      this.water.update(this.tilt, elapsed);
      this.floaters.update(this.tilt, dt);
      this.composer.render();
      this.frameId = requestAnimationFrame(loop);
    };
    this.frameId = requestAnimationFrame(loop);
  }

  dispose(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    this.timer.dispose();
    this.water.dispose();
    this.floaters.dispose();
    this.composer.dispose();
    this.envMap.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
