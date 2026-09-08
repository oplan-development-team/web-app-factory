import * as THREE from 'three';

const FOV = 55;
/** World-space half-extents that must stay on screen at every aspect ratio. */
const HALF_WIDTH_NEEDED = 6.2;
const HALF_HEIGHT_NEEDED = 4.4;

export interface Stage {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  /** Largest point sprite the driver will actually draw, in device pixels. */
  readonly maxPointSize: number;
  /** Scalar turning a particle's unit scale into device pixels. */
  pointScale(): number;
  resize(): void;
  start(onFrame: (elapsedSeconds: number) => void): void;
  dispose(): void;
}

/**
 * Pulls the camera back far enough that the whole cluster field fits.
 *
 * Clusters are placed from their seed alone, with no knowledge of the viewport,
 * so a tall phone screen would otherwise push half of them off the sides.
 */
export function fitCameraDistance(aspect: number): number {
  const halfFov = (FOV * Math.PI) / 180 / 2;
  const safeAspect = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  const forHeight = HALF_HEIGHT_NEEDED / Math.tan(halfFov);
  const forWidth = HALF_WIDTH_NEEDED / (Math.tan(halfFov) * safeAspect);
  return Math.max(forHeight, forWidth);
}

/**
 * Builds the renderer, or returns null when WebGL is unavailable.
 *
 * three.js throws from the WebGLRenderer constructor in that case, and an
 * uncaught throw here would leave the page as a blank gradient. The caller
 * shows the CSS fallback instead.
 */
export function createStage(canvas: HTMLCanvasElement): Stage | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
  } catch {
    return null;
  }

  renderer.setClearAlpha(0);
  // Particle colours are the design reference's sRGB hex values, written
  // straight into the shader. Leaving the default sRGB conversion on would
  // brighten them away from the palette the panels are matched to.
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const gl = renderer.getContext();
  const pointRange = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null;
  const maxPointSize = pointRange && pointRange.length > 1 ? pointRange[1] : 255;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, canvas.clientHeight || window.innerHeight);
    // Capped: a 3x display gains nothing visible here but triples the fill cost.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = fitCameraDistance(camera.aspect);
    camera.updateProjectionMatrix();
  };
  resize();

  let frame = 0;
  const startedAt = performance.now();
  let onResize: (() => void) | null = null;

  return {
    scene,
    camera,
    renderer,
    maxPointSize,
    pointScale() {
      const height = Math.max(1, canvas.clientHeight || window.innerHeight);
      return height * 0.172 * renderer.getPixelRatio();
    },
    resize,
    start(onFrame) {
      onResize = () => resize();
      window.addEventListener('resize', onResize);
      const loop = () => {
        frame = requestAnimationFrame(loop);
        onFrame((performance.now() - startedAt) / 1000);
        renderer.render(scene, camera);
      };
      loop();
    },
    dispose() {
      if (frame) cancelAnimationFrame(frame);
      if (onResize) window.removeEventListener('resize', onResize);
      renderer.dispose();
    },
  };
}
