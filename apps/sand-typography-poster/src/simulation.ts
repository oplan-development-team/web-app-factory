import { jitteredRgba, type ColorPreset } from './colors';

/**
 * Tilt magnitude (radians) past which the letterform boundary stops acting
 * as a solid wall and starts letting settled sand spill out under gravity.
 * Comfortably inside the ±30° drag range so a deliberate tilt visibly
 * erodes the shape without the letter crumbling from incidental wobble.
 */
export const WALL_BREACH_RAD = (14 * Math.PI) / 180;

interface Dir {
  dx: number;
  dy: number;
}

// Base priority order at rest (gravity pointing straight down): the
// requirement's own words — down, then down-left, then down-right — is
// encoded as the first three entries so ties resolve exactly that way at
// zero tilt. The remaining directions matter only once gravity swings far
// enough for one of them to become the closest match.
const DIRS_A: Dir[] = [
  { dx: 0, dy: 1 },
  { dx: -1, dy: 1 },
  { dx: 1, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: -1, dy: -1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: -1 },
];
// Mirrored variant, alternated frame-to-frame so the left/down-left vs.
// right/down-right tie-break doesn't silently drift the whole pile to one
// side over thousands of frames.
const DIRS_B: Dir[] = [
  { dx: 0, dy: 1 },
  { dx: 1, dy: 1 },
  { dx: -1, dy: 1 },
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: -1 },
  { dx: 0, dy: -1 },
  { dx: -1, dy: -1 },
];

function dirAngle(d: Dir): number {
  return Math.atan2(d.dx, d.dy);
}

function angDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

const ANGLES_A = DIRS_A.map(dirAngle);
const ANGLES_B = DIRS_B.map(dirAngle);

/**
 * Grid-based falling-sand cellular automaton. Each cell holds at most one
 * grain, represented directly as an RGBA pixel so the buffer can be blitted
 * straight to canvas via putImageData. Movement direction is derived from a
 * live gravity angle so a drag-tilt re-evaluates every grain's angle of
 * repose every frame — settled sand is not a special state, it's simply a
 * grain that currently has nowhere legal to go.
 */
export class SandSimulation {
  width: number;
  height: number;
  mask: Uint8Array;
  pixels: Uint8ClampedArray;
  private next: Uint8ClampedArray;
  // Sticky "has this grain ever settled inside the letterform" flag. Fresh
  // pour grains that simply miss the mask must vanish cleanly (that's the
  // whole point of the stencil reveal), but grains that were once part of
  // the settled letter and later get knocked loose by a tilt should be able
  // to come to rest again — otherwise a hard tilt has nowhere to put the
  // material except "delete it", which reads as the whole poster silently
  // evaporating rather than an actual heap crumbling away.
  private everSettled: Uint8Array;
  private nextEverSettled: Uint8Array;
  private frame = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.mask = new Uint8Array(width * height);
    this.pixels = new Uint8ClampedArray(width * height * 4);
    this.next = new Uint8ClampedArray(width * height * 4);
    this.everSettled = new Uint8Array(width * height);
    this.nextEverSettled = new Uint8Array(width * height);
  }

  setMask(mask: Uint8Array): void {
    this.mask = mask;
  }

  clear(): void {
    this.pixels.fill(0);
    this.everSettled.fill(0);
  }

  countOccupied(): number {
    let n = 0;
    for (let i = 3; i < this.pixels.length; i += 4) {
      if (this.pixels[i] !== 0) n++;
    }
    return n;
  }

  /** Spawn up to `count` grains along the top row at random x positions. */
  spawnRow(count: number, preset: ColorPreset, rand: () => number): void {
    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * 4 + 8;
    while (placed < count && attempts < maxAttempts) {
      attempts++;
      const x = Math.floor(rand() * this.width);
      const idx = (x * 4) as number;
      if (this.pixels[idx + 3] === 0) {
        const [r, g, b, a] = jitteredRgba(preset, rand);
        this.pixels[idx] = r;
        this.pixels[idx + 1] = g;
        this.pixels[idx + 2] = b;
        this.pixels[idx + 3] = a;
        this.everSettled[x] = 0;
        placed++;
      }
    }
  }

  /** Advance the automaton by one tick under the given gravity angle (radians, 0 = straight down). */
  step(gravityAngle: number): void {
    const { width: W, height: H, mask, pixels, everSettled } = this;
    const next = this.next;
    const nextEverSettled = this.nextEverSettled;
    next.fill(0);
    nextEverSettled.fill(0);

    const useA = this.frame % 2 === 0;
    const angles = useA ? ANGLES_A : ANGLES_B;
    const dirs = useA ? DIRS_A : DIRS_B;

    // Below the repose threshold the letterform boundary behaves like the
    // wall of a mould: settled grains can't wander back out of it, which is
    // what lets a pour reliably fill the shape under plain vertical gravity.
    // Past the threshold the wall opens in whatever direction gravity now
    // points, so a hard-enough tilt genuinely erodes material out of the
    // shape instead of just resettling it internally.
    const wallsHold = Math.abs(gravityAngle) < WALL_BREACH_RAD;

    // Rank the 8 directions by closeness to the current gravity vector,
    // once per step (constant across the whole grid this tick).
    const order = angles
      .map((a, i) => ({ i, d: angDiff(a, gravityAngle) }))
      .sort((p, q) => p.d - q.d)
      .slice(0, 3)
      .map((p) => dirs[p.i]!);

    // Bottom-to-top so a grain that moves this tick is never re-processed.
    for (let y = H - 1; y >= 0; y--) {
      const rowStart = y * W;
      for (let x = 0; x < W; x++) {
        const idx = rowStart + x;
        const pi = idx * 4;
        if (pixels[pi + 3] === 0) continue;

        const r = pixels[pi] ?? 0;
        const g = pixels[pi + 1] ?? 0;
        const b = pixels[pi + 2] ?? 0;
        const a = pixels[pi + 3] ?? 0;
        const insideMask = mask[idx] === 1;
        const wasEverSettled = everSettled[idx] === 1;

        let moved = false;
        for (const dir of order) {
          const nx = x + dir.dx;
          const ny = y + dir.dy;
          // Off-grid in any direction (including past the bottom edge) is
          // simply not a legal target — it does NOT by itself mean the
          // grain despawns. A settled letterform pixel sitting on the very
          // last row must still be able to rest there.
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          const ti = ny * W + nx;
          // Sand already settled inside the letterform can't leak back out
          // through its boundary while the walls hold — only sand still in
          // transit outside the mask is free to wander through both mask
          // and non-mask cells (that's how it finds its way into the shape
          // from above in the first place).
          if (insideMask && wallsHold && mask[ti] !== 1) continue;
          const tpi = ti * 4;
          if (next[tpi + 3] === 0) {
            next[tpi] = r;
            next[tpi + 1] = g;
            next[tpi + 2] = b;
            next[tpi + 3] = a;
            nextEverSettled[ti] = wasEverSettled ? 1 : 0;
            moved = true;
            break;
          }
        }

        if (!moved) {
          // A cell can hold still sand if it's inside the letterform, OR if
          // it's loose material that once belonged to the letter and has
          // now been knocked out by a tilt — that grain gets to pile up
          // wherever it lands rather than disappearing. Sand that has
          // *never* been part of the shape (pour overflow that simply
          // missed the mask) has no such privilege and is dropped, which is
          // what keeps the initial reveal clean.
          if (insideMask || wasEverSettled) {
            if (next[pi + 3] === 0) {
              next[pi] = r;
              next[pi + 1] = g;
              next[pi + 2] = b;
              next[pi + 3] = a;
              nextEverSettled[idx] = 1;
            }
          }
        }
      }
    }

    this.pixels.set(next);
    this.everSettled.set(nextEverSettled);
    this.frame++;
  }
}
