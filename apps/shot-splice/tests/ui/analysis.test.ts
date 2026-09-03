import { describe, expect, it, vi } from 'vitest';

import { computeLayout, noCuts } from '../../src/core/layout';
import type { GrayImage } from '../../src/core/types';
import {
  createAnalyzer,
  cutsEqual,
  detectBands,
  detectSeam,
  workingGrays,
} from '../../src/ui/analysis';
import { createToolbar } from '../../src/ui/toolbar';
import { exportPng } from '../../src/ui/export';
import {
  addShots,
  initialState,
  setBusy,
  type AppState,
  type Shot,
} from '../../src/ui/store';
import { fakeFactory, fakeSource } from '../helpers/fake-canvas';
import { noiseImage, overlappingPair, withFixedBands } from '../helpers/gray-fixtures';

function shot(id: string, width = 100, height = 400): Shot {
  return {
    id,
    name: `${id}.png`,
    source: fakeSource(width, height),
    naturalWidth: width,
    naturalHeight: height,
    averageColor: { r: 0, g: 0, b: 0 },
  };
}

describe('createAnalyzer', () => {
  it('rasterises each shot once per width', () => {
    const toGray = vi.fn((_s: CanvasImageSource, w: number, h: number) => noiseImage(w, h, 1));
    const analyzer = createAnalyzer({ toGray });
    const a = shot('a', 200, 800);

    analyzer.gray(a, 100);
    analyzer.gray(a, 100);
    expect(toGray).toHaveBeenCalledTimes(1);
    // Normalising to half the width halves the height too.
    expect(toGray).toHaveBeenCalledWith(a.source, 100, 400);
  });

  it('re-rasterises when the normalisation width changes', () => {
    const toGray = vi.fn((_s: CanvasImageSource, w: number, h: number) => noiseImage(w, h, 1));
    const analyzer = createAnalyzer({ toGray });
    const a = shot('a');
    analyzer.gray(a, 100);
    analyzer.gray(a, 120);
    expect(toGray).toHaveBeenCalledTimes(2);
  });

  it('drops a single shot and the whole cache on demand', () => {
    const toGray = vi.fn((_s: CanvasImageSource, w: number, h: number) => noiseImage(w, h, 1));
    const analyzer = createAnalyzer({ toGray });
    analyzer.gray(shot('a'), 100);
    analyzer.forget('a');
    analyzer.gray(shot('a'), 100);
    expect(toGray).toHaveBeenCalledTimes(2);
    analyzer.clear();
    analyzer.gray(shot('a'), 100);
    expect(toGray).toHaveBeenCalledTimes(3);
  });
});

describe('detectSeam', () => {
  it('recovers a known overlap end to end', () => {
    const { upper, lower } = overlappingPair(120, 500, 500, 173, 9);
    const result = detectSeam(upper, lower);
    expect(result.overlapPx).toBe(173);
    expect(result.matched).toBe(true);
  });

  it('reports no match for unrelated shots', () => {
    const result = detectSeam(noiseImage(120, 400, 1), noiseImage(120, 400, 2));
    expect(result.matched).toBe(false);
  });
});

describe('detectBands', () => {
  const grays = new Map<string, GrayImage>();
  const analyzer = {
    gray: (s: Shot) => grays.get(s.id) as GrayImage,
    forget: () => {},
    clear: () => {},
  };

  it('finds the shared header on the uncut buffers', () => {
    const header = noiseImage(60, 44, 5);
    const [a, b] = withFixedBands([noiseImage(60, 300, 6), noiseImage(60, 300, 7)], header, null);
    grays.set('a', a as GrayImage);
    grays.set('b', b as GrayImage);
    expect(detectBands(analyzer, [shot('a'), shot('b')], 60)).toEqual({ headerPx: 44, footerPx: 0 });
  });

  it('returns zero without enough shots or width', () => {
    expect(detectBands(analyzer, [shot('a')], 60)).toEqual({ headerPx: 0, footerPx: 0 });
    expect(detectBands(analyzer, [shot('a'), shot('b')], 0)).toEqual({ headerPx: 0, footerPx: 0 });
  });
});

describe('workingGrays', () => {
  it('applies each shot’s own cut', () => {
    const toGray = vi.fn((_s: CanvasImageSource, w: number, h: number) => noiseImage(w, h, 3));
    const analyzer = createAnalyzer({ toGray });
    const shots = [shot('a'), shot('b'), shot('c')];
    const layout = computeLayout(
      shots.map((s) => ({ width: s.naturalWidth, height: s.naturalHeight })),
      [0, 0],
      { headerPx: 40, footerPx: 60, trimEnds: false },
    );
    const grays = workingGrays(analyzer, shots, 100, layout);
    expect(grays.map((g) => g.height)).toEqual([340, 300, 360]);
  });

  it('passes buffers through when the layout has no matching slot', () => {
    const toGray = vi.fn((_s: CanvasImageSource, w: number, h: number) => noiseImage(w, h, 3));
    const analyzer = createAnalyzer({ toGray });
    const layout = computeLayout([], [], noCuts);
    expect(workingGrays(analyzer, [shot('a')], 100, layout)[0]?.height).toBe(400);
  });
});

describe('cutsEqual', () => {
  it('compares every field', () => {
    const base = { headerPx: 10, footerPx: 20, trimEnds: false };
    expect(cutsEqual(base, { ...base })).toBe(true);
    expect(cutsEqual(base, { ...base, headerPx: 11 })).toBe(false);
    expect(cutsEqual(base, { ...base, footerPx: 21 })).toBe(false);
    expect(cutsEqual(base, { ...base, trimEnds: true })).toBe(false);
  });
});

function buildToolbar() {
  const callbacks = {
    onAdd: vi.fn(),
    onDetectAll: vi.fn(),
    onExport: vi.fn(),
    onClear: vi.fn(),
  };
  const toolbar = createToolbar(callbacks);
  document.body.append(toolbar.element);
  return { toolbar, callbacks };
}

function withShots(...ids: readonly string[]): AppState {
  return addShots(initialState(), ids.map((id) => shot(id))).state;
}

describe('createToolbar', () => {
  it('keeps compose actions disabled below two shots', () => {
    const { toolbar } = buildToolbar();
    toolbar.update(withShots('a'));
    const buttons = toolbar.element.querySelectorAll<HTMLButtonElement>('.btn');
    expect(buttons[2]?.disabled).toBe(true);
    expect(buttons[3]?.disabled).toBe(true);
    toolbar.update(withShots('a', 'b'));
    expect(buttons[2]?.disabled).toBe(false);
    expect(buttons[3]?.disabled).toBe(false);
  });

  it('locks every action while work is in flight', () => {
    const { toolbar } = buildToolbar();
    toolbar.update(setBusy(withShots('a', 'b'), { kind: 'detecting', done: 1, total: 2 }));
    const buttons = toolbar.element.querySelectorAll<HTMLButtonElement>('.btn');
    expect(Array.from(buttons).every((b) => b.disabled)).toBe(true);
  });

  it('narrates progress instead of going quiet (FR-603)', () => {
    const { toolbar } = buildToolbar();
    const progress = toolbar.element.querySelector('.toolbar__progress') as HTMLElement;
    toolbar.update(withShots('a', 'b'));
    expect(progress.hasAttribute('hidden')).toBe(true);

    toolbar.update(setBusy(withShots('a', 'b'), { kind: 'detecting', done: 2, total: 5 }));
    expect(progress.hasAttribute('hidden')).toBe(false);
    expect(progress.textContent).toContain('2 / 5');

    toolbar.update(setBusy(withShots('a', 'b'), { kind: 'loading', message: '読み込み中' }));
    expect(progress.textContent).toContain('読み込み中');

    toolbar.update(setBusy(withShots('a', 'b'), { kind: 'exporting' }));
    expect(progress.textContent).toContain('書き出し中');
  });

  it('forwards picked files and clears the input so the same file can be re-picked', () => {
    const { toolbar, callbacks } = buildToolbar();
    const picker = toolbar.element.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });
    // jsdom has no DataTransfer, so the FileList is stubbed directly.
    Object.defineProperty(picker, 'files', {
      configurable: true,
      get: () => [file] as unknown as FileList,
    });
    picker.dispatchEvent(new Event('change'));
    expect(callbacks.onAdd).toHaveBeenCalledWith([file]);
  });

  it('routes the remaining buttons', () => {
    const { toolbar, callbacks } = buildToolbar();
    toolbar.update(withShots('a', 'b'));
    const buttons = toolbar.element.querySelectorAll<HTMLButtonElement>('.btn');
    buttons[1]?.click();
    buttons[2]?.click();
    buttons[3]?.click();
    expect(callbacks.onClear).toHaveBeenCalled();
    expect(callbacks.onDetectAll).toHaveBeenCalled();
    expect(callbacks.onExport).toHaveBeenCalled();
  });
});

describe('exportPng', () => {
  const sources = [
    { source: fakeSource(100, 400), naturalWidth: 100, naturalHeight: 400 },
    { source: fakeSource(100, 400), naturalWidth: 100, naturalHeight: 400 },
  ];
  const layout = computeLayout(
    [
      { width: 100, height: 400 },
      { width: 100, height: 400 },
    ],
    [100],
    noCuts,
  );

  it('refuses an empty layout', async () => {
    await expect(exportPng(sources, computeLayout([], [], noCuts), [])).rejects.toThrow(/ありません/);
  });

  it('explains a failed encode instead of failing silently (FR-505)', async () => {
    // A fake canvas has no toBlob, standing in for a surface the browser refuses.
    await expect(exportPng(sources, layout, ['lower'], { factory: fakeFactory() })).rejects.toThrow(
      /大きすぎる/,
    );
  });

  it('hands the blob to the saver with a timestamped name', async () => {
    const saveBlob = vi.fn();
    const factory = fakeFactory();
    const withBlob = Object.assign(
      (w: number, h: number) => {
        const canvas = factory(w, h) as unknown as HTMLCanvasElement;
        canvas.toBlob = (cb: BlobCallback) => cb(new Blob(['x'], { type: 'image/png' }));
        return canvas as unknown as ReturnType<typeof factory>;
      },
      { created: factory.created },
    );
    const name = await exportPng(sources, layout, ['lower'], {
      factory: withBlob,
      saveBlob,
      now: () => new Date(2026, 8, 1, 9, 5, 3),
    });
    expect(name).toBe('shot-splice-20260901-090503.png');
    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), name);
  });
});
