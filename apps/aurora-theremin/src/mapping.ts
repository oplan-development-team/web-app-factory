// Pure mapping functions shared by the live performance path and the loop
// playback path, so a recorded gesture reproduces identical pitch/volume/
// timbre behaviour when it loops.

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// --- X position -> pitch (continuous glissando, no quantisation) ----------

export const MIN_FREQ = 110; // A2
export const OCTAVE_SPAN = 2; // roughly two octaves of travel
export const MAX_FREQ = MIN_FREQ * Math.pow(2, OCTAVE_SPAN);

export function xToFreq(xNorm: number): number {
  const x = clamp01(xNorm);
  return MIN_FREQ * Math.pow(2, OCTAVE_SPAN * x);
}

// --- Y position -> volume (top of screen = loud) ---------------------------

export const MIN_DB = -42;
export const MAX_DB = -3;

export function yToGainDb(yNormTopIsLoud: number): number {
  const y = clamp01(yNormTopIsLoud);
  return MIN_DB + (MAX_DB - MIN_DB) * y;
}

export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

// --- Speed -> expressive second parameter -----------------------------------
// speedNorm is expected to already be normalised to roughly [0, 1] by the
// caller (distance travelled per ms, divided by a reference max speed).

export function speedToVibratoDepthCents(speedNorm: number): number {
  return 3 + clamp01(speedNorm) * 34; // near-still hum .. wide wobble
}

export function speedToVibratoRateHz(speedNorm: number): number {
  return 4.2 + clamp01(speedNorm) * 4.8; // 4.2 .. 9 Hz
}

export function speedToFilterCutoff(speedNorm: number): number {
  return 850 + clamp01(speedNorm) * 3800; // muffled .. bright
}

// --- Pitch -> curated aurora hue --------------------------------------------
// Deep green -> teal -> violet -> magenta. Never crosses into red/orange/
// yellow, so the palette reads as "aurora", not "rainbow".

const HUE_STOPS = [148, 176, 208, 262, 300, 322];

export function pitchToHue(xNorm: number): number {
  const x = clamp01(xNorm);
  const segments = HUE_STOPS.length - 1;
  const scaled = x * segments;
  const i = Math.min(segments - 1, Math.floor(scaled));
  const t = scaled - i;
  return HUE_STOPS[i] + (HUE_STOPS[i + 1] - HUE_STOPS[i]) * t;
}
