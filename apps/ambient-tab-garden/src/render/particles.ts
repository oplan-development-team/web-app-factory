import * as THREE from 'three';
import { makeRandom } from '../domain/cluster';
import type { ClusterView } from '../domain/types';
import type { UpgradeEffects } from '../domain/upgrades';

const TAU = Math.PI * 2;
/** Seconds for a cluster to fade in when a tab opens, or out when it closes. */
const FADE_SECONDS = 1.1;

const VERTEX_SHADER = /* glsl */ `
  attribute vec3 aCenter;
  attribute float aPhase;
  attribute float aScale;
  attribute float aSpin;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uSize;
  uniform float uScaleMul;
  uniform float uMotion;
  uniform float uOrbit;
  uniform float uMaxPoint;

  varying vec3 vColor;

  void main() {
    vec3 p = position;

    // Slow, uncorrelated drift. Done here rather than on the CPU so particle
    // count costs GPU fill, not per-frame JavaScript.
    p.x += sin(uTime * 0.22 + aPhase) * 0.20 * uMotion;
    p.y += cos(uTime * 0.18 + aPhase * 1.3) * 0.24 * uMotion;
    p.z += sin(uTime * 0.15 + aPhase * 0.7) * 0.18 * uMotion;

    if (uOrbit > 0.0) {
      vec3 rel = p - aCenter;
      float ang = uTime * (0.06 + 0.045 * uOrbit) * aSpin * uMotion;
      float c = cos(ang);
      float s = sin(ang);
      rel.xy = vec2(rel.x * c - rel.y * s, rel.x * s + rel.y * c);
      p = aCenter + rel;
    }

    vColor = aColor;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = min(uMaxPoint, aScale * uSize * uScaleMul / max(0.001, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  uniform float uCoreWhite;
  uniform float uAlphaPow;
  uniform float uFade;

  varying vec3 vColor;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float falloff = 1.0 - smoothstep(0.0, 0.5, dist);
    float core = pow(falloff, 3.0);
    vec3 col = mix(vColor, vec3(1.0), core * uCoreWhite);
    float alpha = pow(falloff, uAlphaPow) * uOpacity * uFade;
    if (alpha <= 0.001) discard;

    gl_FragColor = vec4(col, alpha);
  }
`;

interface Layer {
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;
}

interface Entry {
  geometry: THREE.BufferGeometry;
  halo: Layer;
  core: Layer;
  /** Signature of the attributes currently uploaded, so we only rebuild on change. */
  signature: string;
  fade: number;
  dying: boolean;
}

function makeMaterial(opts: {
  scaleMul: number;
  opacity: number;
  coreWhite: number;
  alphaPow: number;
  maxPointSize: number;
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 155 },
      uScaleMul: { value: opts.scaleMul },
      uMotion: { value: 1 },
      uOrbit: { value: 0 },
      uMaxPoint: { value: opts.maxPointSize },
      uOpacity: { value: opts.opacity },
      uCoreWhite: { value: opts.coreWhite },
      uAlphaPow: { value: opts.alphaPow },
      uFade: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    // Normal, *not* additive. Adding light to an already near-white backdrop
    // bleaches the orbs into the background; the mockup's orbs read because
    // they are more saturated than the field behind them, not brighter.
    blending: THREE.NormalBlending,
  });
}

/**
 * Builds the particle attributes for one cluster.
 *
 * Everything is derived from the cluster seed, so the same tab produces the
 * same arrangement in every tab that draws it and across reloads.
 */
function buildGeometry(cluster: ClusterView, effects: UpgradeEffects): THREE.BufferGeometry {
  const count = cluster.particleCount;
  const rnd = makeRandom(cluster.seed ^ 0x1a2b3c4d);
  const spread = 0.78 + cluster.stage * 0.38 + effects.particleBonus * 0.014;

  const positions = new Float32Array(count * 3);
  const centers = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const scales = new Float32Array(count);
  const spins = new Float32Array(count);

  const [cx, cy, cz] = cluster.position;
  const [hr, hg, hb] = cluster.hue;

  for (let i = 0; i < count; i++) {
    let ox = 0;
    let oy = 0;
    let oz = 0;
    let scale: number;

    if (i === 0) {
      // The core orb: every cluster has exactly one anchor, and it grows.
      scale = 4.2 + cluster.stage * 0.6;
    } else {
      const angle = rnd() * TAU;
      const radius = spread * Math.sqrt(rnd());
      ox = Math.cos(angle) * radius;
      oy = Math.sin(angle) * radius * 0.85;
      oz = (rnd() * 2 - 1) * spread * 0.5;
      scale = 0.55 + rnd() * 1.7;
    }

    positions[i * 3] = cx + ox;
    positions[i * 3 + 1] = cy + oy;
    positions[i * 3 + 2] = cz + oz;

    centers[i * 3] = cx;
    centers[i * 3 + 1] = cy;
    centers[i * 3 + 2] = cz;

    // A minority of pure-white motes, as in the reference: they keep the
    // cluster from reading as a single flat colour blob.
    const isWhiteAccent = i > 0 && rnd() < 0.3;
    colors[i * 3] = isWhiteAccent ? 1 : hr;
    colors[i * 3 + 1] = isWhiteAccent ? 1 : hg;
    colors[i * 3 + 2] = isWhiteAccent ? 1 : hb;

    phases[i] = rnd() * TAU;
    scales[i] = scale;
    // Inner particles sweep faster than outer ones, so orbits do not look rigid.
    spins[i] = (0.4 + rnd() * 1.2) * (rnd() < 0.5 ? -1 : 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aCenter', new THREE.BufferAttribute(centers, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
  geometry.setAttribute('aSpin', new THREE.BufferAttribute(spins, 1));
  return geometry;
}

function signatureOf(cluster: ClusterView, effects: UpgradeEffects): string {
  return [cluster.particleCount, cluster.stage, effects.particleBonus, cluster.hue.join(',')].join('|');
}

/** Owns every cluster currently on screen and reconciles it against app state. */
export class Garden {
  private entries = new Map<string, Entry>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly maxPointSize: number,
  ) {}

  /** Adds, rebuilds and retires clusters to match the given views. */
  sync(clusters: readonly ClusterView[], effects: UpgradeEffects): void {
    const seen = new Set<string>();

    for (const cluster of clusters) {
      seen.add(cluster.id);
      const signature = signatureOf(cluster, effects);
      const existing = this.entries.get(cluster.id);

      if (!existing) {
        this.entries.set(cluster.id, this.createEntry(cluster, effects, signature));
        continue;
      }

      existing.dying = false;
      if (existing.signature !== signature) {
        // Attributes changed (grew a stage, or an upgrade landed). Swap the
        // buffers in place and keep the current fade so nothing blinks.
        const geometry = buildGeometry(cluster, effects);
        existing.geometry.dispose();
        existing.geometry = geometry;
        existing.core.points.geometry = geometry;
        existing.halo.points.geometry = geometry;
        existing.signature = signature;
      }
    }

    for (const [id, entry] of this.entries) {
      if (!seen.has(id)) entry.dying = true;
    }
  }

  /** Advances fades and pushes the per-frame uniforms. */
  update(elapsedSeconds: number, deltaSeconds: number, effects: UpgradeEffects, motion: number): void {
    const pending: string[] = [];

    for (const [id, entry] of this.entries) {
      const target = entry.dying ? 0 : 1;
      const step = deltaSeconds / FADE_SECONDS;
      entry.fade += Math.sign(target - entry.fade) * Math.min(step, Math.abs(target - entry.fade));

      if (entry.dying && entry.fade <= 0.001) {
        pending.push(id);
        continue;
      }

      for (const layer of [entry.halo, entry.core]) {
        const u = layer.material.uniforms;
        u.uTime.value = elapsedSeconds;
        u.uFade.value = entry.fade;
        u.uMotion.value = motion;
        u.uOrbit.value = effects.orbitStrength;
      }
      entry.halo.material.uniforms.uScaleMul.value = 3.4 * effects.haloScale;
      entry.halo.material.uniforms.uOpacity.value = effects.haloOpacity;
    }

    for (const id of pending) this.remove(id);
  }

  setPointScale(size: number): void {
    for (const entry of this.entries.values()) {
      entry.core.material.uniforms.uSize.value = size;
      entry.halo.material.uniforms.uSize.value = size;
    }
  }

  get clusterCount(): number {
    return this.entries.size;
  }

  private createEntry(cluster: ClusterView, effects: UpgradeEffects, signature: string): Entry {
    const geometry = buildGeometry(cluster, effects);

    const halo = this.addLayer(
      geometry,
      makeMaterial({
        scaleMul: 3.4 * effects.haloScale,
        opacity: effects.haloOpacity,
        coreWhite: 0.25,
        alphaPow: 1.6,
        maxPointSize: this.maxPointSize,
      }),
      0,
    );
    const core = this.addLayer(
      geometry,
      makeMaterial({
        scaleMul: 1,
        opacity: 0.95,
        coreWhite: 0.92,
        alphaPow: 2,
        maxPointSize: this.maxPointSize,
      }),
      1,
    );

    return { geometry, halo, core, signature, fade: 0, dying: false };
  }

  private addLayer(
    geometry: THREE.BufferGeometry,
    material: THREE.ShaderMaterial,
    renderOrder: number,
  ): Layer {
    const points = new THREE.Points(geometry, material);
    points.renderOrder = renderOrder;
    // Particles carry their own world offsets, so three.js must not cull the
    // cluster using a bounding sphere it never computed.
    points.frustumCulled = false;
    this.scene.add(points);
    return { points, material };
  }

  private remove(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    for (const layer of [entry.halo, entry.core]) {
      this.scene.remove(layer.points);
      layer.material.dispose();
    }
    entry.geometry.dispose();
    this.entries.delete(id);
  }

  dispose(): void {
    for (const id of [...this.entries.keys()]) this.remove(id);
  }
}
