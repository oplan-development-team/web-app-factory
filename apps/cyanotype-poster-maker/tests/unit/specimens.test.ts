/**
 * 全所蔵標本に同じ基準で当てる不変条件（PLAN 4）。
 *
 * 「植物に見えるか」は最終的に目で見るしかないが、意匠として成立するための
 * 最低条件は数値へ落とせる。ここが通らない図案は、見た目を確認するまでもなく
 * 破綻している。
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { setCanvasFactory } from '../../src/core/ctx2d';
import { SPECIMENS, drawSpecimen, specimenById } from '../../src/specimens';
import { TONE } from '../../src/specimens/shared';
import { FakeCtx, fakeCanvasFactory } from '../fakes/fakeCtx';
import { coverageRatio, organBounds, renderSpecimen, usedTones } from '../helpers/specimenChecks';

beforeEach(() => {
  setCanvasFactory(fakeCanvasFactory());
});

describe('登録簿', () => {
  it('6 種が登録されている（FR-120）', () => {
    expect(SPECIMENS).toHaveLength(6);
  });

  it('id が重複しない', () => {
    expect(new Set(SPECIMENS.map((s) => s.id)).size).toBe(SPECIMENS.length);
  });

  it('図版番号が重複しない', () => {
    expect(new Set(SPECIMENS.map((s) => s.plateNo)).size).toBe(SPECIMENS.length);
  });

  it('ラベルの既定値がすべて埋まっている（FR-127）', () => {
    for (const s of SPECIMENS) {
      expect(s.scientificName.trim()).not.toBe('');
      expect(s.commonName.trim()).not.toBe('');
      expect(s.locality.trim()).not.toBe('');
      expect(s.label.trim()).not.toBe('');
      expect(s.note.trim()).not.toBe('');
    }
  });

  it('学名が二名法の体裁である', () => {
    for (const s of SPECIMENS) {
      expect(s.scientificName).toMatch(/^[A-Z][a-z]+ [a-z]+$/);
    }
  });

  it('id で引ける / 未知の id は undefined', () => {
    expect(specimenById('fern')?.id).toBe('fern');
    expect(specimenById('nonexistent')).toBeUndefined();
  });
});

describe('drawSpecimen', () => {
  it('未知の id では描かず false を返す', () => {
    const ctx = new FakeCtx(200, 200);
    expect(drawSpecimen(ctx, 'nope', 1, 200, 200)).toBe(false);
    expect(ctx.calls).toHaveLength(0);
  });

  it('既知の id では描いて true を返す', () => {
    const ctx = new FakeCtx(200, 200);
    expect(drawSpecimen(ctx, 'fern', 1, 200, 200)).toBe(true);
    expect(ctx.calls.length).toBeGreaterThan(50);
  });

  it('同一 (id, seed) は常に同一の描画列（AC-07）', () => {
    const render = (): string => {
      setCanvasFactory(fakeCanvasFactory());
      const ctx = new FakeCtx(400, 500);
      drawSpecimen(ctx, 'venation', 777, 400, 500);
      return ctx.signature();
    };
    const first = render();
    for (let i = 0; i < 20; i++) expect(render()).toBe(first);
  });

  it('呼び出し順に依存しない（毎回シードから組み直す）', () => {
    const sign = (): string => {
      setCanvasFactory(fakeCanvasFactory());
      const ctx = new FakeCtx(300, 400);
      drawSpecimen(ctx, 'ginkgo', 42, 300, 400);
      return ctx.signature();
    };
    const clean = sign();
    // 別の標本を挟んでから、もう一度同じものを描く
    setCanvasFactory(fakeCanvasFactory());
    drawSpecimen(new FakeCtx(300, 400), 'grass', 9, 300, 400);
    expect(sign()).toBe(clean);
  });
});

describe.each(SPECIMENS.map((s) => [s.id, s] as const))('所蔵標本 %s の不変条件', (_id, specimen) => {
  const seeds = [1, 4242, 99999, 123456789];

  it('決定的である（AC-07）', () => {
    for (const seed of seeds) {
      const a = renderSpecimen(specimen, seed);
      const b = renderSpecimen(specimen, seed);
      expect(a.ctx.signature()).toBe(b.ctx.signature());
    }
  });

  it('シードが違えば図案も違う（FR-125）', () => {
    const signatures = new Set(seeds.map((seed) => renderSpecimen(specimen, seed).ctx.signature()));
    expect(signatures.size).toBe(seeds.length);
  });

  it('陰画の階調帯に収まる（FR-122）', () => {
    for (const seed of seeds) {
      const tones = usedTones(renderSpecimen(specimen, seed));
      expect(tones.length).toBeGreaterThan(1);
      for (const tone of tones) {
        const isGround = tone >= TONE.groundBase - TONE.groundSwing && tone <= TONE.groundBase + TONE.groundSwing;
        const isOrgan = tone >= TONE.lamina - 1 && tone <= TONE.core + 1;
        expect(isGround || isOrgan, `階調 ${tone} が帯の外`).toBe(true);
      }
    }
  });

  it('地と植物体の双方が描かれている', () => {
    const tones = usedTones(renderSpecimen(specimen, 31));
    expect(tones.some((t) => t <= TONE.groundBase + TONE.groundSwing)).toBe(true);
    expect(tones.some((t) => t >= TONE.lamina)).toBe(true);
  });

  it('描画領域を大きくはみ出さない', () => {
    for (const seed of seeds) {
      const result = renderSpecimen(specimen, seed);
      const b = organBounds(result);
      expect(b).not.toBeNull();
      if (!b) continue;
      // 半影のぶん少しの食い出しは許容するが、領域外へ逃げていないこと
      const marginX = result.width * 0.06;
      const marginY = result.height * 0.06;
      expect(b.minX).toBeGreaterThan(-marginX);
      expect(b.minY).toBeGreaterThan(-marginY);
      expect(b.maxX).toBeLessThan(result.width + marginX);
      expect(b.maxY).toBeLessThan(result.height + marginY);
    }
  });

  it('空白すぎず、埋まりすぎない（被覆 25%〜92%）', () => {
    for (const seed of seeds) {
      const ratio = coverageRatio(renderSpecimen(specimen, seed));
      expect(ratio, `seed=${seed} の被覆 ${ratio.toFixed(3)}`).toBeGreaterThan(0.25);
      expect(ratio, `seed=${seed} の被覆 ${ratio.toFixed(3)}`).toBeLessThan(0.92);
    }
  });

  it('縦横比が変わっても収まる', () => {
    for (const [w, h] of [
      [112, 140],
      [1104, 1180],
      [900, 900],
    ] as const) {
      const result = renderSpecimen(specimen, 7, w, h);
      const b = organBounds(result);
      expect(b).not.toBeNull();
      if (!b) continue;
      expect(b.minX).toBeGreaterThan(-w * 0.08);
      expect(b.maxX).toBeLessThan(w * 1.08);
      expect(b.maxY).toBeLessThan(h * 1.08);
    }
  });

  it('解像度を上げても描画呼び出し数が増えない（FR-123 / 拡大でなく直接描画）', () => {
    const small = renderSpecimen(specimen, 5, 300, 400);
    const large = renderSpecimen(specimen, 5, 3000, 4000);
    expect(large.ctx.calls.length).toBe(small.ctx.calls.length);
  });

  it('解像度に比例して座標が伸びる（サムネイルは製品の縮小である）', () => {
    const small = renderSpecimen(specimen, 5, 300, 400);
    const large = renderSpecimen(specimen, 5, 600, 800);
    const sb = organBounds(small);
    const lb = organBounds(large);
    expect(sb).not.toBeNull();
    expect(lb).not.toBeNull();
    if (!sb || !lb) return;
    expect(lb.maxX / sb.maxX).toBeCloseTo(2, 1);
    expect(lb.maxY / sb.maxY).toBeCloseTo(2, 1);
  });

  it('極端に小さい寸法でも例外を出さない', () => {
    expect(() => renderSpecimen(specimen, 3, 24, 30)).not.toThrow();
  });
});
