/**
 * Lotus leaves and stones floating on the water: procedural geometry only
 * (ExtrudeGeometry for the leaf silhouette, a jittered IcosahedronGeometry
 * for pebbles), PBR materials, and motion driven by the pure
 * `floaterMotion` model (FR-2, FR-9, FR-15).
 */
import * as THREE from 'three';
import { createFloaterState, nextFloaterState, type FloaterState } from '../lib/floaterMotion';
import type { TiltState } from '../lib/tiltState';
import { WATER_RADIUS } from './water';

/** Tiny seeded PRNG so pebble jitter is reproducible; not shared with src/lib
 * on purpose — this is presentation-only noise with no correctness contract
 * to unit test, unlike the ripple field. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    return ((a >>> 0) % 1000) / 1000;
  };
}

function createLeafGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const radius = 0.55;
  const notchHalfAngle = 0.3;
  const segments = 40;
  shape.moveTo(0, 0);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = notchHalfAngle + t * (Math.PI * 2 - notchHalfAngle * 2);
    shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  shape.lineTo(0, 0);

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.035,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 24,
  });
}

function createStoneGeometry(seed: number): THREE.IcosahedronGeometry {
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const position = geometry.getAttribute('position');
  if (!position) throw new Error('IcosahedronGeometry has no position attribute');
  const random = seededRandom(seed);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const length = Math.sqrt(x * x + y * y + z * z) || 1;
    const jitter = 0.85 + random() * 0.3;
    position.setXYZ(i, (x / length) * jitter, (y / length) * jitter * 0.7, (z / length) * jitter);
  }
  geometry.computeVertexNormals();
  return geometry;
}

interface Floater {
  mesh: THREE.Mesh;
  state: FloaterState;
  physicalRadius: number;
  isStone: boolean;
}

interface FloaterLayoutItem {
  type: 'leaf' | 'stone';
  x: number;
  z: number;
  scale: number;
  seed: number;
}

const LAYOUT: FloaterLayoutItem[] = [
  { type: 'leaf', x: -1.7, z: 0.9, scale: 1, seed: 1 },
  { type: 'leaf', x: 1.3, z: -1.5, scale: 0.72, seed: 2 },
  { type: 'leaf', x: -0.4, z: -2.2, scale: 0.6, seed: 3 },
  { type: 'stone', x: 0.5, z: 1.9, scale: 0.26, seed: 4 },
  { type: 'stone', x: -2.1, z: -0.5, scale: 0.2, seed: 5 },
];

const DRIFT_SPEED = 0.55;

export interface FloatersHandle {
  group: THREE.Group;
  update: (tilt: TiltState, dt: number) => void;
  dispose: () => void;
}

export function createFloaters(): FloatersHandle {
  const group = new THREE.Group();
  const floaters: Floater[] = [];

  const leafGeometry = createLeafGeometry();
  const leafMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#4c7a52'),
    roughness: 0.55,
    metalness: 0.02,
    clearcoat: 0.25,
    clearcoatRoughness: 0.4,
    sheen: 1,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color('#8fbf8a'),
    side: THREE.DoubleSide,
  });
  const stoneMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#8a8377'),
    roughness: 0.85,
    metalness: 0.05,
  });

  for (const item of LAYOUT) {
    const isStone = item.type === 'stone';
    const mesh = new THREE.Mesh(
      isStone ? createStoneGeometry(item.seed) : leafGeometry,
      isStone ? stoneMaterial : leafMaterial,
    );
    mesh.scale.setScalar(item.scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (!isStone) {
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = item.seed * 1.7;
      mesh.position.y = 0.02;
    } else {
      mesh.position.y = item.scale * 0.5;
    }
    mesh.position.x = item.x;
    mesh.position.z = item.z;
    group.add(mesh);

    floaters.push({
      mesh,
      state: createFloaterState(item.x, item.z),
      physicalRadius: item.scale,
      isStone,
    });
  }

  const update = (tilt: TiltState, dt: number) => {
    for (const floater of floaters) {
      floater.state = nextFloaterState(
        floater.state,
        tilt,
        dt,
        DRIFT_SPEED,
        WATER_RADIUS - 0.4,
        floater.physicalRadius,
      );
      floater.mesh.position.x = floater.state.x;
      floater.mesh.position.z = floater.state.z;
      if (floater.isStone) {
        floater.mesh.rotation.x = floater.state.rollX;
        floater.mesh.rotation.z = floater.state.rollZ;
      }
    }
  };

  const dispose = () => {
    leafGeometry.dispose();
    leafMaterial.dispose();
    stoneMaterial.dispose();
    for (const floater of floaters) {
      if (floater.isStone) floater.mesh.geometry.dispose();
    }
  };

  return { group, update, dispose };
}
