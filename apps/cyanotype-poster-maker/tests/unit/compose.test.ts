import { beforeEach, describe, expect, it } from 'vitest';
import { setCanvasFactory } from '../../src/core/ctx2d';
import { getLayoutMetrics, renderPoster, type RenderParams } from '../../src/core/compose';
import { LAYOUT_SIZES, getInkPreset } from '../../src/core/presets';
import { clearFiberCache } from '../../src/core/texture';
import { exportSizeFor, buildFilename } from '../../src/ui/exportImage';
import { FakeCtx, fakeCanvasFactory, recordingCanvasFactory } from '../fakes/fakeCtx';

const label = {
  title: 'Pteridium aquilinum',
  subtitle: 'ワラビ',
  locality: '長野県 霧ヶ峰',
  lat: '36.1023',
  lon: '138.2011',
  date: '2026-08-27',
  specimenNo: '2026.4821.C',
};

function params(overrides: Partial<RenderParams> = {}): RenderParams {
  return {
    source: { kind: 'specimen', specimenId: 'fern' },
    seed: 12345,
    contrast: 20,
    threshold: 128,
    inkPresetId: 'classic',
    mottle: 55,
    grain: 40,
    vignette: 45,
    edgeStyle: 'rough',
    layout: 'vertical',
    label,
    ...overrides,
  };
}

beforeEach(() => {
  setCanvasFactory(fakeCanvasFactory());
  clearFiberCache();
});

describe('レイアウト寸法', () => {
  it('感光域とラベル帯が台紙に収まる', () => {
    for (const layout of ['vertical', 'square'] as const) {
      const base = LAYOUT_SIZES[layout];
      const m = getLayoutMetrics(layout, base.width, base.height);
      expect(m.imageX).toBeGreaterThan(0);
      expect(m.imageW).toBeLessThan(base.width);
      expect(m.imageY + m.imageH + m.labelBandHeight).toBeLessThanOrEqual(base.height);
      expect(m.imageH).toBeGreaterThan(0);
    }
  });

  it('縦長と正方形で縦横比が変わる（AC-13）', () => {
    const v = getLayoutMetrics('vertical', 1200, 1600);
    const s = getLayoutMetrics('square', 1200, 1200);
    expect(v.imageW / v.imageH).not.toBeCloseTo(s.imageW / s.imageH, 2);
  });

  it('寸法に比例する', () => {
    const a = getLayoutMetrics('vertical', 600, 800);
    const b = getLayoutMetrics('vertical', 1200, 1600);
    expect(b.imageW).toBeCloseTo(a.imageW * 2);
    expect(b.imageH).toBeCloseTo(a.imageH * 2);
  });
});

describe('台紙の合成', () => {
  it('ソース未選択でも紙とラベルは描かれる（AC-01）', () => {
    const ctx = new FakeCtx(600, 800);
    renderPoster(ctx, 600, 800, params({ source: null }));
    const paper = getInkPreset('classic').paper;
    expect(ctx.calls.some((c) => c.op === 'fillRect' && c.fillStyle === paper)).toBe(true);
    expect(ctx.calls.some((c) => c.op === 'fillText')).toBe(true);
  });

  it('所蔵標本のプレートが感光域へ合成される', () => {
    const ctx = new FakeCtx(600, 800);
    renderPoster(ctx, 600, 800, params());
    expect(ctx.calls.some((c) => c.op === 'drawImage')).toBe(true);
  });

  it('未知の所蔵標本ではインク版を合成しない', () => {
    const ctx = new FakeCtx(600, 800);
    renderPoster(ctx, 600, 800, params({ source: { kind: 'specimen', specimenId: 'nope' } }));
    expect(ctx.calls.some((c) => c.op === 'drawImage')).toBe(false);
  });

  it('キャンバスの寸法を指定値へ揃える', () => {
    const ctx = new FakeCtx(10, 10);
    renderPoster(ctx, 640.4, 853.6, params());
    expect(ctx.canvas.width).toBe(640);
    expect(ctx.canvas.height).toBe(854);
  });

  it('0 以下の寸法でも 1px 以上になる', () => {
    const ctx = new FakeCtx(10, 10);
    renderPoster(ctx, 0, -5, params({ source: null }));
    expect(ctx.canvas.width).toBe(1);
    expect(ctx.canvas.height).toBe(1);
  });

  it('繊維テクスチャは overlay で重ねる', () => {
    const ctx = new FakeCtx(600, 800);
    renderPoster(ctx, 600, 800, params());
    expect(ctx.calls.some((c) => c.composite === 'overlay')).toBe(true);
  });

  it('インクプリセットを変えると紙色が変わる', () => {
    const paperOf = (id: string): string => {
      const ctx = new FakeCtx(400, 500);
      renderPoster(ctx, 400, 500, params({ inkPresetId: id, source: null }));
      return ctx.calls.find((c) => c.op === 'fillRect')?.fillStyle ?? '';
    };
    expect(paperOf('classic')).not.toBe(paperOf('vintage'));
  });

  it('未知のインクプリセットは既定へ落ちる', () => {
    const ctx = new FakeCtx(400, 500);
    renderPoster(ctx, 400, 500, params({ inkPresetId: 'unknown', source: null }));
    expect(ctx.calls.find((c) => c.op === 'fillRect')?.fillStyle).toBe(getInkPreset('classic').paper);
  });

  it('同一パラメータからは同一の描画列（AC-07）', () => {
    const run = (): string => {
      setCanvasFactory(fakeCanvasFactory());
      clearFiberCache();
      const ctx = new FakeCtx(400, 533);
      renderPoster(ctx, 400, 533, params());
      return ctx.signature();
    };
    expect(run()).toBe(run());
  });

  it('シードに依存する仕事はすべてオフスクリーンで完結する', () => {
    // 最前面の context から見ると、シードが変わっても貼り付け方は同じ。
    // 図案・誤差拡散・縁マスクはオフスクリーンで済ませてから 1 回で貼るため。
    const front = (seed: number): string => {
      setCanvasFactory(fakeCanvasFactory());
      clearFiberCache();
      const ctx = new FakeCtx(400, 533);
      renderPoster(ctx, 400, 533, params({ seed }));
      return ctx.signature();
    };
    expect(front(1)).toBe(front(2));
  });

  it('パイプライン全体ではシードが結果に反映される', () => {
    const whole = (seed: number): string => {
      const recorder = recordingCanvasFactory();
      setCanvasFactory(recorder.factory);
      clearFiberCache();
      const ctx = new FakeCtx(400, 533);
      renderPoster(ctx, 400, 533, params({ seed }));
      return recorder.signature();
    };
    expect(whole(1)).not.toBe(whole(2));
    expect(whole(1)).toBe(whole(1));
  });

  it('所蔵標本を変えるとパイプラインの結果が変わる（AC-05）', () => {
    const whole = (specimenId: string): string => {
      const recorder = recordingCanvasFactory();
      setCanvasFactory(recorder.factory);
      clearFiberCache();
      const ctx = new FakeCtx(400, 533);
      renderPoster(ctx, 400, 533, params({ source: { kind: 'specimen', specimenId } }));
      return recorder.signature();
    };
    expect(whole('fern')).not.toBe(whole('ginkgo'));
  });

  it('しきい値・コントラストの変更が結果に反映される（AC-11）', () => {
    const whole = (overrides: Partial<RenderParams>): string => {
      const recorder = recordingCanvasFactory();
      setCanvasFactory(recorder.factory);
      clearFiberCache();
      const ctx = new FakeCtx(300, 400);
      renderPoster(ctx, 300, 400, params(overrides));
      return recorder.signature();
    };
    const base = whole({});
    expect(whole({ threshold: 190 })).not.toBe(base);
    expect(whole({ contrast: -80 })).not.toBe(base);
    expect(whole({ edgeStyle: 'straight' })).not.toBe(base);
  });
});

describe('書き出し寸法', () => {
  it('基準寸法 × 倍率になる（AC-14）', () => {
    for (const scale of [1, 2, 3]) {
      expect(exportSizeFor('vertical', scale)).toEqual({ width: 1200 * scale, height: 1600 * scale });
      expect(exportSizeFor('square', scale)).toEqual({ width: 1200 * scale, height: 1200 * scale });
    }
  });
});

describe('ファイル名', () => {
  it('標本番号を使う（FR-503）', () => {
    expect(buildFilename('2026.4821.C')).toBe('cyanotype-2026.4821.C.png');
  });

  it('使えない文字を落とす', () => {
    expect(buildFilename('標本/ 01')).toBe('cyanotype-01.png');
  });

  it('空なら既定名になる', () => {
    expect(buildFilename('')).toBe('cyanotype-specimen.png');
    expect(buildFilename('///')).toBe('cyanotype-specimen.png');
  });
});
