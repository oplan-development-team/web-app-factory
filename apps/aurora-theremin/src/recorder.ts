// Gesture recording + looped playback. Samples are taken every animation
// frame (not just on pointermove) so that holding a still position is
// captured faithfully, and played back through the exact same audio/visual
// pipeline used for live performance.

export interface Sample {
  t: number; // ms since the recording started
  x: number; // normalised 0..1 (screen X)
  y: number; // normalised 0..1, 1 = top (loud)
  down: boolean;
  speed: number; // normalised 0..1
}

export const MAX_RECORDING_MS = 45_000;

export class GestureRecorder {
  private samples: Sample[] = [];
  private startTime = 0;
  private recording = false;

  start(): void {
    this.samples = [];
    this.startTime = performance.now();
    this.recording = true;
  }

  /** Returns true if the max duration was just hit and recording auto-stopped. */
  push(x: number, y: number, down: boolean, speed: number): boolean {
    if (!this.recording) return false;
    const t = performance.now() - this.startTime;
    this.samples.push({ t, x, y, down, speed });
    if (t >= MAX_RECORDING_MS) {
      this.recording = false;
      return true;
    }
    return false;
  }

  stop(): Sample[] {
    this.recording = false;
    return this.samples;
  }

  get isRecording(): boolean {
    return this.recording;
  }

  get elapsedMs(): number {
    return this.recording ? performance.now() - this.startTime : 0;
  }
}

/** One loop slot: holds a recorded gesture and replays it on a repeating clock. */
export class LoopLayer {
  samples: Sample[] | null = null;
  duration = 0;
  muted = false;
  private loopStart = 0;
  private lastDown = false;

  assign(samples: Sample[]): void {
    this.samples = samples;
    this.duration = Math.max(200, samples[samples.length - 1]?.t ?? 0);
    this.loopStart = performance.now();
    this.lastDown = false;
  }

  clear(): void {
    this.samples = null;
    this.duration = 0;
    this.lastDown = false;
  }

  get hasData(): boolean {
    return this.samples !== null && this.samples.length > 0;
  }

  /** Force the internal edge-tracker to "up", used when muting mid-note. */
  resetEdge(): void {
    this.lastDown = false;
  }

  /** Sample state at the current point in the loop cycle. */
  sampleAt(nowMs: number): Sample | null {
    if (!this.samples || this.samples.length === 0) return null;
    const t = (nowMs - this.loopStart) % this.duration;
    let lo = 0;
    let hi = this.samples.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.samples[mid].t <= t) lo = mid;
      else hi = mid - 1;
    }
    return this.samples[lo];
  }

  /** Diff against the previous frame's down-state to find note on/off edges. */
  consumeDownEdge(down: boolean): 'on' | 'off' | 'none' {
    if (down && !this.lastDown) {
      this.lastDown = true;
      return 'on';
    }
    if (!down && this.lastDown) {
      this.lastDown = false;
      return 'off';
    }
    this.lastDown = down;
    return 'none';
  }
}
