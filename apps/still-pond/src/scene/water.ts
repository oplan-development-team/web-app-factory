/**
 * The water surface mesh: a PBR (MeshPhysicalMaterial) disc that reflects
 * the baked environment map, carries a procedurally generated tiling
 * normal map for ripple shading (FR-1), and tilts/advects in response to
 * the current TiltState (FR-9, FR-12).
 */
import * as THREE from 'three';
import { computeHeightField, heightFieldToNormalRGBA } from '../lib/rippleField';
import { TILT_CLAMP_DEG, type TiltState } from '../lib/tiltState';

export const WATER_RADIUS = 6;
const NORMAL_MAP_SIZE = 256;
/** How far the tilt (in degrees, clamped to TILT_CLAMP_DEG) visually rocks the plane. */
const TILT_VISUAL_FACTOR = 0.35;

function createRippleNormalTexture(): THREE.DataTexture {
  const height = computeHeightField(NORMAL_MAP_SIZE, 11, 12);
  const rgba = heightFieldToNormalRGBA(height, NORMAL_MAP_SIZE, 3.2);
  const texture = new THREE.DataTexture(rgba, NORMAL_MAP_SIZE, NORMAL_MAP_SIZE, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.needsUpdate = true;
  return texture;
}

export interface WaterHandle {
  mesh: THREE.Mesh;
  update: (tilt: TiltState, elapsedSeconds: number) => void;
  dispose: () => void;
}

export function createWater(envMap: THREE.Texture): WaterHandle {
  const geometry = new THREE.CircleGeometry(WATER_RADIUS, 96);
  const normalMap = createRippleNormalTexture();

  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#25473f'),
    metalness: 0.05,
    roughness: 0.1,
    envMap,
    envMapIntensity: 1.15,
    normalMap,
    normalScale: new THREE.Vector2(0.4, 0.4),
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
    transparent: true,
    opacity: 0.94,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;

  const update = (tilt: TiltState, elapsedSeconds: number) => {
    const gammaRad = THREE.MathUtils.degToRad(tilt.gamma) * TILT_VISUAL_FACTOR;
    const betaRad = THREE.MathUtils.degToRad(tilt.beta) * TILT_VISUAL_FACTOR;
    mesh.rotation.x = -Math.PI / 2 + betaRad;
    mesh.rotation.z = -gammaRad;

    const magnitude = (Math.abs(tilt.beta) + Math.abs(tilt.gamma)) / (TILT_CLAMP_DEG * 2);
    const driftSpeed = 0.035 + magnitude * 0.15;
    normalMap.offset.x = (tilt.gamma / TILT_CLAMP_DEG) * elapsedSeconds * driftSpeed;
    normalMap.offset.y =
      (-tilt.beta / TILT_CLAMP_DEG) * elapsedSeconds * driftSpeed + elapsedSeconds * 0.01;
  };

  const dispose = () => {
    geometry.dispose();
    material.dispose();
    normalMap.dispose();
  };

  return { mesh, update, dispose };
}
