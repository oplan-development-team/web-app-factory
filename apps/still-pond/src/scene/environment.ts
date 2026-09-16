/**
 * Procedural dusk sky + baked environment map. No HDRI or image files are
 * loaded (see docs/specs/still-pond.md "非機能・制約" — アセット調達方針):
 * the sky is a single ShaderMaterial gradient (a calm dusk tone per FR-3),
 * and `bakeEnvironmentMap` uses THREE.PMREMGenerator to turn that same
 * gradient into a reflection/lighting environment map, the same technique
 * `RoomEnvironment` uses internally.
 */
import * as THREE from 'three';

const ZENITH_COLOR = new THREE.Color('#7c8fae');
const HORIZON_COLOR = new THREE.Color('#f0c89a');
const GROUND_COLOR = new THREE.Color('#2e3b3a');
export const SUN_DIRECTION = new THREE.Vector3(0.35, 0.32, -0.88).normalize();
export const SUN_COLOR = new THREE.Color('#ffe3b8');

const SKY_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldDirection;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldDirection = normalize(worldPosition.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vWorldDirection;
  uniform vec3 zenithColor;
  uniform vec3 horizonColor;
  uniform vec3 groundColor;
  uniform vec3 sunDirection;
  uniform vec3 sunColor;

  void main() {
    vec3 dir = normalize(vWorldDirection);
    float h = dir.y;
    vec3 sky = h > 0.0
      ? mix(horizonColor, zenithColor, pow(clamp(h, 0.0, 1.0), 0.6))
      : mix(horizonColor, groundColor, pow(clamp(-h, 0.0, 1.0), 0.8));
    float sun = pow(max(dot(dir, sunDirection), 0.0), 12.0);
    vec3 color = sky + sunColor * sun * 0.65;
    gl_FragColor = vec4(color, 1.0);
  }
`;

function createSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      zenithColor: { value: ZENITH_COLOR },
      horizonColor: { value: HORIZON_COLOR },
      groundColor: { value: GROUND_COLOR },
      sunDirection: { value: SUN_DIRECTION },
      sunColor: { value: SUN_COLOR },
    },
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

/** The visible sky dome, added directly to the main scene. */
export function createSkyMesh(radius = 500): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(radius, 32, 16);
  const mesh = new THREE.Mesh(geometry, createSkyMaterial());
  mesh.renderOrder = -1;
  return mesh;
}

/**
 * Bakes the same gradient sky into a PMREM environment map for reflections
 * and image-based lighting. Renders a small, throwaway scene once at
 * startup — not part of the per-frame render loop.
 */
export function bakeEnvironmentMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const bakeScene = new THREE.Scene();
  const bakeSky = createSkyMesh(50);
  bakeScene.add(bakeSky);

  const renderTarget = pmremGenerator.fromScene(bakeScene, 0.04);

  bakeSky.geometry.dispose();
  (bakeSky.material as THREE.Material).dispose();
  pmremGenerator.dispose();

  return renderTarget.texture;
}
