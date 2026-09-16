/**
 * A single, restrained bloom pass (FR-5). Deliberately avoids stacking
 * multiple heavy passes (SSR, multi-pass bloom, etc.) per the performance
 * budget in docs/specs/still-pond.md (30fps floor under 4x CPU throttling).
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export interface ComposerHandle {
  composer: EffectComposer;
  setSize: (width: number, height: number) => void;
  render: () => void;
  /**
   * EffectComposer.dispose() only frees its own ping-pong render targets —
   * it does not dispose the passes added to it. UnrealBloomPass owns several
   * render targets and materials of its own, so it needs an explicit
   * dispose() call too, or they leak GPU memory.
   */
  dispose: () => void;
}

export function createComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
): ComposerHandle {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.35, 0.55, 0.86);
  composer.addPass(bloom);

  return {
    composer,
    setSize: (w, h) => composer.setSize(w, h),
    render: () => composer.render(),
    dispose: () => {
      bloom.dispose();
      composer.dispose();
    },
  };
}
