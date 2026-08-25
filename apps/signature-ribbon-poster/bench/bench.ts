import { POSTER_HEIGHT, POSTER_WIDTH } from "../src/core/poster";
import { responseToMaxSpeed } from "../src/core/ribbon-metrics";
import type { RibbonPoint, Stroke } from "../src/core/stroke";
import { LiveRenderer } from "../src/render/live-renderer";
import { domCanvasFactory } from "../src/render/types";
import {
  LEGACY_CANVAS_HEIGHT,
  LEGACY_CANVAS_WIDTH,
  legacyRenderScene,
  type LegacyStroke,
} from "./legacy-renderer";

export interface BenchResult {
  readonly points: number;
  readonly newAppendMs: number;
  readonly newRepaintMs: number;
  readonly legacyRepaintMs: number;
  /** Raw per-iteration timings for the prototype path, which varies wildly. */
  readonly legacySamples: number[];
  readonly newBackingPx: number;
  readonly legacyBackingPx: number;
}

/**
 * A signature-like stroke: a looping path whose speed rises and falls the way a
 * hand does, so the width mapping is genuinely exercised rather than constant.
 */
function syntheticStroke(pointCount: number): Stroke {
  const points: RibbonPoint[] = [];
  let t = 0;
  let previous = { x: POSTER_WIDTH * 0.2, y: POSTER_HEIGHT * 0.5 };

  for (let i = 0; i < pointCount; i++) {
    const u = i / (pointCount - 1);
    const x = POSTER_WIDTH * (0.2 + 0.6 * u);
    const y = POSTER_HEIGHT * (0.5 + 0.12 * Math.sin(u * Math.PI * 6));
    // Vary the time step so the speed sweeps most of the mapping's range.
    const dt = 4 + 10 * Math.abs(Math.sin(u * Math.PI * 3));
    t += dt;
    const distance = Math.hypot(x - previous.x, y - previous.y);
    points.push({ x, y, t, speed: distance / dt });
    previous = { x, y };
  }

  return { colorId: "gold", points };
}

function toLegacy(stroke: Stroke, hex: string): LegacyStroke {
  return { points: stroke.points.map((point) => ({ ...point })), color: hex };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function timeMedian(iterations: number, run: () => void): number {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  }
  return median(samples);
}

export async function runBench(pointCount: number, cssWidth: number): Promise<BenchResult> {
  const display = document.querySelector<HTMLCanvasElement>("#new-canvas")!;
  const legacy = document.querySelector<HTMLCanvasElement>("#legacy-canvas")!;
  const stroke = syntheticStroke(pointCount);
  const maxSpeed = responseToMaxSpeed(50);

  const renderer = new LiveRenderer({
    display,
    createCanvas: domCanvasFactory,
    backgroundHex: "#0a0908",
    maxSpeed,
    cssWidth,
    pixelRatio: window.devicePixelRatio || 1,
  });

  // Warm up: get the whole artwork onto the core layer once.
  renderer.setStrokes([stroke], false);
  renderer.render();

  // The hot path while drawing: one more point lands on an already-long stroke.
  const APPEND_SAMPLES = 200;
  const start = Math.max(2, pointCount - APPEND_SAMPLES);
  const live: Stroke = { colorId: stroke.colorId, points: stroke.points.slice(0, start) };
  renderer.invalidate();
  renderer.setStrokes([live], true);
  renderer.render();

  const appendSamples: number[] = [];
  for (let n = start; n < pointCount; n++) {
    // Mutating in place keeps array copying out of the measurement.
    live.points.push(stroke.points[n]!);
    const t0 = performance.now();
    renderer.setStrokes([live], true);
    renderer.render();
    appendSamples.push(performance.now() - t0);
  }
  const newAppendMs = median(appendSamples);

  const newRepaintMs = timeMedian(30, () => {
    renderer.invalidate();
    renderer.setStrokes([stroke], false);
    renderer.render();
  });

  legacy.width = LEGACY_CANVAS_WIDTH;
  legacy.height = LEGACY_CANVAS_HEIGHT;
  const legacyCtx = legacy.getContext("2d")!;
  const legacyStrokes = [toLegacy(stroke, "#d9ac4c")];
  const paintLegacy = (): void => {
    legacyRenderScene(
      legacyCtx,
      LEGACY_CANVAS_WIDTH,
      LEGACY_CANVAS_HEIGHT,
      "#0a0908",
      legacyStrokes
    );
  };

  // Only a handful of iterations: a single prototype repaint of a long stroke can
  // already take seconds, which is the very problem being measured. Samples are
  // reported individually because the spread between them is itself the finding.
  paintLegacy();
  const legacySamples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    paintLegacy();
    legacySamples.push(performance.now() - t0);
  }
  const legacyRepaintMs = median(legacySamples);

  return {
    points: pointCount,
    newAppendMs,
    newRepaintMs,
    legacyRepaintMs,
    legacySamples,
    newBackingPx: display.width * display.height,
    legacyBackingPx: LEGACY_CANVAS_WIDTH * LEGACY_CANVAS_HEIGHT,
  };
}

declare global {
  interface Window {
    runBench: typeof runBench;
  }
}

window.runBench = runBench;
document.querySelector("#out")!.textContent = "ready";
