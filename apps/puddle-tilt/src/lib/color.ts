/**
 * Thin-film-interference-style colouring for the puddle surface.
 *
 * The film colour cycles teal -> magenta -> gold -> teal as the (normalized)
 * height value sweeps through its range, mimicking how an oil film's colour
 * shifts with thickness. A slow time-based phase drift is layered on top so
 * the whole surface shimmers gently even when the water is nearly flat.
 *
 * Colour is authored as three HSL anchor colours (easy to retune), then
 * *linearly interpolated in RGB* between them — never by sweeping hue
 * continuously around the full wheel. A continuous hue sweep between, say,
 * gold (42deg) and teal (178deg) necessarily crosses yellow and green on
 * the way, which reads as a garish rainbow test-pattern rather than the
 * intended teal/magenta/gold jewel palette. RGB-lerping between fixed
 * anchors guarantees every rendered colour is a blend of only those three.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function fract(v: number): number {
  return v - Math.floor(v);
}

/** Converts HSL (h in deg, s/l in 0..1) to RGB bytes 0..255. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = l - c / 2;
  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
}

/** Anchor colours authored in HSL for readability, converted once at load. */
const TEAL = hslToRgb(178, 0.55, 0.32);
const MAGENTA = hslToRgb(320, 0.55, 0.32);
const GOLD = hslToRgb(42, 0.55, 0.36);

const FILM_STOPS: ReadonlyArray<{ t: number; rgb: [number, number, number] }> = [
  { t: 0, rgb: TEAL },
  { t: 1 / 3, rgb: MAGENTA },
  { t: 2 / 3, rgb: GOLD },
  { t: 1, rgb: TEAL },
];

/**
 * Maps a cyclic parameter t (any real number, wraps every 1.0) to an RGB
 * colour following the teal -> magenta -> gold -> teal ramp, interpolated
 * linearly in RGB space between the three anchor colours.
 */
export function filmColorAt(t: number): [number, number, number] {
  const tt = fract(t);
  for (let i = 0; i < FILM_STOPS.length - 1; i++) {
    const a = FILM_STOPS[i] as { t: number; rgb: [number, number, number] };
    const b = FILM_STOPS[i + 1] as { t: number; rgb: [number, number, number] };
    if (tt >= a.t && tt <= b.t) {
      const localT = (tt - a.t) / (b.t - a.t || 1);
      return [
        a.rgb[0] + (b.rgb[0] - a.rgb[0]) * localT,
        a.rgb[1] + (b.rgb[1] - a.rgb[1]) * localT,
        a.rgb[2] + (b.rgb[2] - a.rgb[2]) * localT,
      ];
    }
  }
  return [...TEAL];
}

/**
 * Estimates a surface normal from the four cardinal neighbour heights using
 * a central-difference gradient. Returns a unit vector; z is "up" toward
 * the viewer.
 */
export function computeNormal(
  left: number,
  right: number,
  up: number,
  down: number,
  strength = 1,
): Vec3 {
  const dx = -(right - left) * 0.5 * strength;
  const dy = -(down - up) * 0.5 * strength;
  const dz = 1;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  return { x: dx / len, y: dy / len, z: dz / len };
}

function dot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Blinn-Phong-ish specular term against a fixed light, clamped 0..1. */
export function specularIntensity(normal: Vec3, light: Vec3, shininess = 24): number {
  const d = Math.max(0, dot3(normal, light));
  return Math.pow(d, shininess);
}

export interface ShadeParams {
  /** raw height value from the simulation */
  height: number;
  normal: Vec3;
  light: Vec3;
  /** cyclic phase offset in [0,1), advances slowly over time for shimmer */
  phase: number;
  /** scales how much a unit of height shifts the film-colour cycle */
  hueScale?: number;
  /** brightness multiplier applied to the resting (height=0) film colour */
  baseBrightness?: number;
}

// Kept deliberately gentle: one full unit of t sweeps the *entire*
// teal->magenta->gold->teal cycle, so a hueScale much above this crams
// several cycles into one ripple's height range — busy and prone to visible
// banding when a coarse grid is bilinear-upscaled. A slow sweep reads as a
// "thin film", a fast one reads as a test pattern.
const DEFAULT_HUE_SCALE = 0.3;
const DEFAULT_BASE_BRIGHTNESS = 0.78;
// Brightness only tracks a soft-clamped ("compressed") version of height so
// a sharp impulse keeps cycling colour instead of blowing straight out to
// flat white — real thin-film interference keeps shifting hue as the film
// gets thicker, it doesn't just get brighter.
const BRIGHTNESS_COMPRESS_LIMIT = 1.1;
const BRIGHTNESS_HEIGHT_GAIN = 0.5;
const BRIGHTNESS_MIN = 0.32;
const BRIGHTNESS_MAX = 1.55;

/** Softly saturates large values toward +-limit instead of hard-clipping. */
function compress(value: number, limit: number): number {
  return limit * Math.tanh(value / limit);
}

/** Full shading pipeline for one cell: thin-film colour + specular highlight. */
export function shadeCell(params: ShadeParams): [number, number, number] {
  const hueScale = params.hueScale ?? DEFAULT_HUE_SCALE;
  const baseBrightness = params.baseBrightness ?? DEFAULT_BASE_BRIGHTNESS;

  const [baseR, baseG, baseB] = filmColorAt(params.height * hueScale + params.phase);
  const compressedHeight = compress(params.height, BRIGHTNESS_COMPRESS_LIMIT);
  const brightness = clamp(
    baseBrightness + compressedHeight * BRIGHTNESS_HEIGHT_GAIN,
    BRIGHTNESS_MIN,
    BRIGHTNESS_MAX,
  );

  const spec = specularIntensity(params.normal, params.light);
  const highlight = spec * 175;

  return [
    clampByte(baseR * brightness + highlight),
    clampByte(baseG * brightness + highlight * 0.92),
    clampByte(baseB * brightness + highlight * 0.72),
  ];
}

function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function clampByte(v: number): number {
  if (v < 0) return 0;
  if (v > 255) return 255;
  return Math.round(v);
}
