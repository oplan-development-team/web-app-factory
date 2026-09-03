import { seededRng } from './prng.ts';
import {
  buildBorderBand,
  buildTintField,
  buildUnitRosette,
  layerCountFor,
  placeRosette,
  samplesPerTurnFor,
  type GuillocheLayer,
} from './guilloche.ts';
import {
  denominationSpelledText,
  issuingBankName,
  serialNumber,
  type BanknoteState,
} from './banknoteData.ts';
import { INK_PRESETS, PAPER_PRESETS } from './presets.ts';

export const NOTE_WIDTH = 1050;
export const NOTE_HEIGHT = 450;

export interface CharGlyph {
  ch: string;
  x: number;
  y: number;
  rotate: number;
}

export interface TextRun {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  font: 'title' | 'italic' | 'mono' | 'label';
  color: string;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
  alpha?: number;
}

export interface NotePlan {
  width: number;
  height: number;
  paperColor: string;
  paperGrain: string;
  inkMain: string;
  inkSerial: string;
  frame: { outerInset: number; innerInset: number; contentInset: number; ruleWidth: number };
  weightMultiplier: number;
  layers: {
    tint: GuillocheLayer[];
    border: GuillocheLayer[];
    numeralRing: GuillocheLayer[];
    centralRosette: GuillocheLayer[];
    cornerRosettes: GuillocheLayer[];
  };
  titleChars: CharGlyph[];
  titleFontSize: number;
  texts: TextRun[];
  specimen: {
    rows: { text: string; x: number; y: number }[];
    rotate: number;
    fontSize: number;
    letterSpacing: number;
    color: string;
    centerX: number;
    centerY: number;
  };
}

function estimateAdvance(fontSize: number, letterSpacing: number): number {
  return fontSize * 0.62 + letterSpacing;
}

function archTitleChars(
  text: string,
  cx: number,
  baselineY: number,
  fontSize: number,
  letterSpacing: number,
  archDepth: number
): CharGlyph[] {
  const advance = estimateAdvance(fontSize, letterSpacing);
  const totalWidth = advance * text.length;
  const startX = cx - totalWidth / 2 + advance / 2;
  const half = totalWidth / 2 || 1;
  const maxRotate = 0.11;

  const glyphs: CharGlyph[] = [];
  for (let i = 0; i < text.length; i++) {
    const x = startX + i * advance;
    const u = (x - cx) / half;
    const y = baselineY - archDepth * (1 - u * u);
    const rotate = u * maxRotate;
    glyphs.push({ ch: text[i] as string, x, y, rotate });
  }
  return glyphs;
}

export interface EngravingSettings {
  precision: number; // 0..100
  weight: number; // 0..100
}

function mapLin(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = (v - inMin) / (inMax - inMin);
  return outMin + Math.max(0, Math.min(1, t)) * (outMax - outMin);
}

export function buildNotePlan(
  state: BanknoteState,
  engraving: EngravingSettings,
  inkIndex: number,
  paperIndex: number
): NotePlan {
  const ink = INK_PRESETS[inkIndex] ?? INK_PRESETS[0]!;
  const paper = PAPER_PRESETS[paperIndex] ?? PAPER_PRESETS[0]!;

  const seedBase = `${state.country}|${state.currency}|${state.denomination}|${state.portraitSeed}|${state.year}`;
  const portraitRng = seededRng(state.portraitSeed || seedBase, 'portrait');
  const cornerRng = seededRng(`${state.denomination}|${state.currency}`, 'corner');
  const borderRng = seededRng(seedBase, 'border');
  const tintRng = seededRng(seedBase, 'tint');
  const numeralRingRng = seededRng(`${state.denomination}|${state.country}`, 'numeral-ring');

  const W = NOTE_WIDTH;
  const H = NOTE_HEIGHT;

  const frame = { outerInset: 8, innerInset: 14, contentInset: 50, ruleWidth: 1.6 };
  const bandWidth = frame.contentInset - frame.innerInset - 4;
  const bandRect = {
    x0: frame.innerInset + 2,
    y0: frame.innerInset + 2,
    x1: W - frame.innerInset - 2,
    y1: H - frame.innerInset - 2,
  };

  const content = {
    x0: frame.contentInset,
    y0: frame.contentInset,
    x1: W - frame.contentInset,
    y1: H - frame.contentInset,
  };
  const cw = content.x1 - content.x0;
  const ch = content.y1 - content.y0;
  const contentCx = (content.x0 + content.x1) / 2;
  const contentCy = (content.y0 + content.y1) / 2;
  const bandCenterTopY = (frame.innerInset + frame.contentInset) / 2;
  const bandCenterBottomY = H - (frame.innerInset + frame.contentInset) / 2;

  const precision = engraving.precision;
  const weightMultiplier = mapLin(engraving.weight, 0, 100, 0.55, 2.1);

  // --- Zone (c): background tint field ---
  const tint = buildTintField(tintRng, content, precision);

  // --- Zone (b): border band ---
  const border = buildBorderBand(borderRng, bandRect, bandWidth, precision);

  // --- Zone (a): central rosette ("portrait" stand-in) ---
  const rosetteRadius = ch * 0.42;
  const rosetteCx = content.x0 + cw * 0.665;
  const rosetteCy = contentCy;
  const centralRosette = placeRosette(
    buildUnitRosette(portraitRng, rosetteRadius, layerCountFor(precision, 4, 8), samplesPerTurnFor(precision, 50, 200), 2600),
    rosetteCx,
    rosetteCy
  );

  // --- Numeral ring behind the large left-side denomination numeral ---
  const numeralRingRadius = ch * 0.335;
  const numeralCx = content.x0 + cw * 0.15;
  const numeralCy = contentCy;
  const numeralRing = placeRosette(
    buildUnitRosette(numeralRingRng, numeralRingRadius, layerCountFor(precision, 3, 6), samplesPerTurnFor(precision, 40, 160), 1800),
    numeralCx,
    numeralCy
  );

  // --- Zone (d): 4 corner denomination rosettes ---
  const cornerRadius = ch * 0.13;
  const cornerInsetX = cw * 0.1;
  const cornerInsetY = ch * 0.17;
  const cornerCenters = [
    { x: content.x0 + cornerInsetX, y: content.y0 + cornerInsetY },
    { x: content.x1 - cornerInsetX, y: content.y0 + cornerInsetY },
    { x: content.x0 + cornerInsetX, y: content.y1 - cornerInsetY },
    { x: content.x1 - cornerInsetX, y: content.y1 - cornerInsetY },
  ];
  const cornerRosetteBase = buildUnitRosette(cornerRng, cornerRadius, layerCountFor(precision, 3, 6), samplesPerTurnFor(precision, 36, 140), 1400);
  const cornerRosettes: GuillocheLayer[] = [];
  for (const c of cornerCenters) {
    cornerRosettes.push(...placeRosette(cornerRosetteBase, c.x, c.y));
  }

  // --- Text content ---
  const country = state.country.trim() || 'NOWHERE';
  const titleText = country.toUpperCase();
  let titleFontSize = mapLin(Math.max(6, titleText.length), 22, 6, 30, 46);
  // Hard safety clamp: whatever the input length, the arched title may never
  // estimate wider than the safe zone between the two corner rosettes — long
  // country names shrink further rather than overlapping the artwork.
  const titleMaxWidth = cw * 0.86;
  const titleLetterSpacing = 4;
  const estimatedTitleWidth = estimateAdvance(titleFontSize, titleLetterSpacing) * titleText.length;
  if (estimatedTitleWidth > titleMaxWidth) {
    titleFontSize *= titleMaxWidth / estimatedTitleWidth;
    titleFontSize = Math.max(14, titleFontSize);
  }
  const titleChars = archTitleChars(titleText, contentCx, content.y0 + ch * 0.135, titleFontSize, titleLetterSpacing, 10);

  const currencyLabelText = (state.currency.trim() || 'CURRENCY').toUpperCase();
  const denomText = String(state.denomination);
  const spelledText = denominationSpelledText(state);
  const bankText = issuingBankName(state);
  const serialText = serialNumber(state);

  const texts: TextRun[] = [
    {
      text: currencyLabelText,
      x: contentCx,
      y: content.y0 + ch * 0.135 + titleFontSize * 0.62 + 8,
      fontSize: 13,
      font: 'italic',
      color: ink.main,
      align: 'center',
      letterSpacing: 3,
      alpha: 0.85,
    },
    // big left numeral
    {
      text: denomText,
      x: numeralCx,
      y: numeralCy + numeralRingRadius * 0.34,
      fontSize: numeralRingRadius * 1.05,
      font: 'title',
      color: ink.main,
      align: 'center',
      letterSpacing: 0,
    },
    // corner numerals (small)
    ...cornerCenters.map((c) => ({
      text: denomText,
      x: c.x,
      y: c.y + cornerRadius * 0.32,
      fontSize: cornerRadius * 0.82,
      font: 'title' as const,
      color: ink.main,
      align: 'center' as const,
      letterSpacing: 0,
    })),
    {
      text: bankText,
      x: contentCx,
      y: content.y1 - ch * 0.075,
      fontSize: 14.5,
      font: 'italic',
      color: ink.main,
      align: 'center',
      letterSpacing: 1,
    },
    {
      text: spelledText,
      x: contentCx,
      y: content.y1 - ch * 0.02,
      fontSize: 17,
      font: 'italic',
      color: ink.main,
      align: 'center',
      letterSpacing: 0.5,
    },
    // Small mono readouts (year + the two serial impressions) live in the
    // border-band margin above/below the content rect, never inside it —
    // that guarantees they never collide with the central rosette / numeral
    // ring artwork regardless of how the shapes above happen to be sized.
    {
      text: `A.D. ${state.year || '----'}`,
      x: contentCx,
      y: bandCenterTopY,
      fontSize: 11,
      font: 'mono',
      color: ink.main,
      align: 'center',
      letterSpacing: 1.5,
      alpha: 0.85,
    },
    {
      text: serialText,
      x: content.x0 + cw * 0.25,
      y: bandCenterBottomY,
      fontSize: 12.5,
      font: 'mono',
      color: ink.serial,
      align: 'center',
      letterSpacing: 1.2,
    },
    {
      text: serialText,
      x: content.x1 - cw * 0.25,
      y: bandCenterBottomY,
      fontSize: 12.5,
      font: 'mono',
      color: ink.serial,
      align: 'center',
      letterSpacing: 1.2,
    },
  ];

  // --- SPECIMEN overprint (fixed, non-removable) ---
  const specimenRows: { text: string; x: number; y: number }[] = [];
  const specRowGap = 78;
  const specText = '  SPECIMEN  ·  SPECIMEN  ·  SPECIMEN  ';
  for (let i = -2; i <= 2; i++) {
    specimenRows.push({ text: specText, x: 0, y: i * specRowGap });
  }

  return {
    width: W,
    height: H,
    paperColor: paper.color,
    paperGrain: paper.grain,
    inkMain: ink.main,
    inkSerial: ink.serial,
    frame,
    weightMultiplier,
    layers: { tint, border, numeralRing, centralRosette, cornerRosettes },
    titleChars,
    titleFontSize,
    texts,
    specimen: {
      rows: specimenRows,
      rotate: -0.32,
      fontSize: 40,
      letterSpacing: 6,
      color: 'rgba(120, 24, 30, 0.24)',
      centerX: W / 2,
      centerY: H / 2,
    },
  };
}
