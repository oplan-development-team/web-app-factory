/**
 * A single, restrained bloom pass (FR-5). Deliberately avoids stacking
 * multiple heavy passes (SSR, multi-pass bloom, etc.) per the performance
 * budget in docs/specs/still-pond.md (30fps floor under 4x CPU throttling).
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export function createComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.35, 0.55, 0.86);
  composer.addPass(bloom);

  return composer;
}
