import { describe, expect, it } from 'vitest';

import { MAX_BAND_RATIO, detectCommonBands } from '../../src/core/banding';
import { noiseImage, solidImage, withFixedBands } from '../helpers/gray-fixtures';

describe('detectCommonBands', () => {
  it('finds a header and footer shared by every shot (AC-201)', () => {
    const header = noiseImage(40, 88, 101);
    const footer = noiseImage(40, 132, 102);
    const bodies = [
      noiseImage(40, 900, 111),
      noiseImage(40, 900, 112),
      noiseImage(40, 900, 113),
    ];
    const shots = withFixedBands(bodies, header, footer);
    expect(detectCommonBands(shots)).toEqual({ headerPx: 88, footerPx: 132 });
  });

  it('finds a header when there is no footer', () => {
    const header = noiseImage(40, 60, 121);
    const shots = withFixedBands([noiseImage(40, 500, 131), noiseImage(40, 500, 132)], header, null);
    expect(detectCommonBands(shots)).toEqual({ headerPx: 60, footerPx: 0 });
  });

  it('returns zero when the shots share nothing (AC-203)', () => {
    const shots = [noiseImage(40, 400, 141), noiseImage(40, 400, 142), noiseImage(40, 400, 143)];
    expect(detectCommonBands(shots)).toEqual({ headerPx: 0, footerPx: 0 });
  });

  it('clips identical shots to the band ratio instead of swallowing the image (AC-202)', () => {
    const image = noiseImage(40, 400, 151);
    const limit = Math.floor(400 * MAX_BAND_RATIO);
    expect(detectCommonBands([image, image, image])).toEqual({ headerPx: limit, footerPx: limit });
  });

  it('clips a flat solid set the same way (E-07)', () => {
    const shots = [solidImage(40, 200, 255), solidImage(40, 200, 255)];
    const limit = Math.floor(200 * MAX_BAND_RATIO);
    expect(detectCommonBands(shots)).toEqual({ headerPx: limit, footerPx: limit });
  });

  it('returns zero for fewer than two shots (AC-204)', () => {
    expect(detectCommonBands([])).toEqual({ headerPx: 0, footerPx: 0 });
    expect(detectCommonBands([noiseImage(40, 400, 161)])).toEqual({ headerPx: 0, footerPx: 0 });
  });

  it('uses the shortest shot when heights differ', () => {
    const header = noiseImage(40, 50, 171);
    const shots = withFixedBands([noiseImage(40, 150, 181), noiseImage(40, 900, 182)], header, null);
    expect(detectCommonBands(shots).headerPx).toBe(50);
  });

  it('stops at the first row that differs, not the last matching one', () => {
    const header = noiseImage(40, 30, 191);
    const shots = withFixedBands([noiseImage(40, 300, 201), noiseImage(40, 300, 202)], header, null);
    // Row 30 onward is body noise and must not be absorbed into the header.
    expect(detectCommonBands(shots).headerPx).toBe(30);
  });

  it('tolerates near-identical bands within the threshold', () => {
    const base = noiseImage(40, 40, 211);
    const shifted = {
      data: Uint8ClampedArray.from(base.data, (v, i) => v + (i % 2 === 0 ? 3 : -3)),
      width: base.width,
      height: base.height,
    };
    const shots = [
      { ...base, data: new Uint8ClampedArray([...base.data, ...noiseImage(40, 200, 221).data]), height: 240 },
      { ...base, data: new Uint8ClampedArray([...shifted.data, ...noiseImage(40, 200, 222).data]), height: 240 },
    ];
    expect(detectCommonBands(shots).headerPx).toBe(40);
  });

  it('keeps header and footer from overlapping each other', () => {
    const image = noiseImage(40, 20, 231);
    const result = detectCommonBands([image, image], { maxBandRatio: 0.9 });
    expect(result.headerPx + result.footerPx).toBeLessThanOrEqual(20);
  });

  it('honours a custom row-match threshold', () => {
    const header = noiseImage(40, 25, 241);
    const shots = withFixedBands([noiseImage(40, 300, 251), noiseImage(40, 300, 252)], header, null);
    expect(detectCommonBands(shots, { rowMatchThreshold: 0 }).headerPx).toBe(25);
  });
});
