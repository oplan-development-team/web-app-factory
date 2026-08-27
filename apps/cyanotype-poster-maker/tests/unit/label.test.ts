import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BLANK_COORDINATE,
  formatCoordinate,
  formatCoordinatePair,
  formatLatitude,
  formatLongitude,
  parseLatitude,
  parseLongitude,
} from '../../src/label/coordinates';
import { clampText, drawLabel, formatDate } from '../../src/label/drawLabel';
import { getCurrentPosition, mapGeoError, type GeolocationLike } from '../../src/label/geolocation';
import { setCanvasFactory } from '../../src/core/ctx2d';
import { FakeCtx, fakeCanvasFactory } from '../fakes/fakeCtx';

beforeEach(() => {
  setCanvasFactory(fakeCanvasFactory());
});

describe('座標の検証（FR-405 / AC-16）', () => {
  it('通常の値を受け入れる', () => {
    expect(parseLatitude('35.6812')).toBeCloseTo(35.6812);
    expect(parseLongitude('-139.7671')).toBeCloseTo(-139.7671);
  });

  it('範囲の両端は受け入れる', () => {
    expect(parseLatitude('90')).toBe(90);
    expect(parseLatitude('-90')).toBe(-90);
    expect(parseLongitude('180')).toBe(180);
    expect(parseLongitude('-180')).toBe(-180);
  });

  it('範囲外は拒否する', () => {
    expect(parseLatitude('90.1')).toBeNull();
    expect(parseLatitude('-91')).toBeNull();
    expect(parseLongitude('181')).toBeNull();
  });

  it('非数値・空・NaN は拒否する', () => {
    for (const value of ['', '   ', 'abc', 'NaN', 'Infinity', '35.6.8']) {
      expect(parseLatitude(value), value).toBeNull();
    }
  });

  it('範囲外・非数値は伏字へ落ちる', () => {
    expect(formatLatitude('999')).toBe(BLANK_COORDINATE);
    expect(formatLongitude('abc')).toBe(BLANK_COORDINATE);
    expect(formatCoordinatePair('', '')).toBe(`${BLANK_COORDINATE}, ${BLANK_COORDINATE}`);
  });

  it('半球の記号が付く', () => {
    expect(formatLatitude('35.6812')).toBe('35.6812°N');
    expect(formatLatitude('-35.6812')).toBe('35.6812°S');
    expect(formatLongitude('139.7671')).toBe('139.7671°E');
    expect(formatLongitude('-139.7671')).toBe('139.7671°W');
  });

  it('0 は北・東として扱う', () => {
    expect(formatLatitude('0')).toBe('0.0000°N');
    expect(formatLongitude('0')).toBe('0.0000°E');
  });

  it('小数第4位へ丸める（FR-404.3）', () => {
    expect(formatCoordinate(35.68123456)).toBe('35.6812');
    expect(formatLatitude('35.68129')).toBe('35.6813°N');
  });
});

describe('日付の整形', () => {
  it('区切りをピリオドへ置き換える', () => {
    expect(formatDate('2026-08-27')).toBe('2026.08.27');
  });

  it('未入力・不正な形式は伏字（FR-403）', () => {
    for (const value of ['', '2026', '2026/08/27', 'abc']) {
      expect(formatDate(value), value).toBe('----.--.--');
    }
  });
});

describe('文字数の切り詰め（FR-406）', () => {
  it('上限内はそのまま', () => {
    expect(clampText('Rosa rugosa', 20)).toBe('Rosa rugosa');
  });

  it('超過分は省略記号になる', () => {
    const result = clampText('a'.repeat(50), 10);
    expect(result).toHaveLength(10);
    expect(result.endsWith('…')).toBe(true);
  });

  it('前後の空白を落とす', () => {
    expect(clampText('  Rosa  ', 20)).toBe('Rosa');
  });
});

describe('ラベルの描画', () => {
  const fields = {
    title: 'Pteridium aquilinum',
    subtitle: 'ワラビ',
    locality: '長野県 霧ヶ峰',
    lat: '36.1023',
    lon: '138.2011',
    date: '2026-08-27',
    specimenNo: '2026.4821.C',
  };
  const rect = { x: 40, y: 600, width: 520, height: 200 };

  it('3層の書体を使い分ける（NFR-006）', () => {
    const ctx = new FakeCtx(600, 800);
    drawLabel(ctx, rect, '#123a63', fields);
    const fonts = ctx.calls.filter((c) => c.op === 'fillText').map((c) => c.font);
    expect(fonts.some((f) => f.includes('italic') && f.includes('EB Garamond'))).toBe(true);
    expect(fonts.some((f) => !f.includes('italic') && f.includes('EB Garamond'))).toBe(true);
    expect(fonts.some((f) => f.includes('Special Elite'))).toBe(true);
  });

  it('台帳欄の見出しと値をすべて描く', () => {
    const ctx = new FakeCtx(600, 800);
    drawLabel(ctx, rect, '#123a63', fields);
    const texts = ctx.calls.filter((c) => c.op === 'fillText').map((c) => c.text);
    expect(texts).toContain('DATE');
    expect(texts).toContain('COORDINATES');
    expect(texts).toContain('SPECIMEN NO.');
    expect(texts).toContain('2026.08.27');
    expect(texts).toContain('2026.4821.C');
    expect(texts).toContain('36.1023°N, 138.2011°E');
  });

  it('未入力でも伏字で埋めて欄を落とさない（FR-403）', () => {
    const ctx = new FakeCtx(600, 800);
    drawLabel(ctx, rect, '#123a63', { ...fields, title: '', subtitle: '', locality: '', date: '', specimenNo: '', lat: '', lon: '' });
    const texts = ctx.calls.filter((c) => c.op === 'fillText').map((c) => c.text);
    expect(texts).toContain('Herbarium Specimen');
    expect(texts).toContain('Locality not recorded');
    expect(texts).toContain('----.--.--');
    expect(texts).toContain('—');
  });

  it('長い学名は幅に収まるまで縮小する（FR-402）', () => {
    const ctx = new FakeCtx(600, 800);
    // 実在する長大な学名（オーストラリアの草木、45文字）
    drawLabel(ctx, rect, '#123a63', { ...fields, title: 'Pseudocarcharias kamoharai kamoharaiensis' });
    const title = ctx.calls.find((c) => c.op === 'fillText');
    const size = Number(/(\d+(?:\.\d+)?)px/.exec(title?.font ?? '')?.[1]);
    const baseSize = Math.max(14, rect.height * 0.155);
    expect(size).toBeLessThan(baseSize);
    // 収まるところまでは縮むが、半分より小さくはしない
    expect(size).toBeGreaterThanOrEqual(baseSize * 0.5);
    expect(ctx.measureText(title?.text ?? '').width).toBeLessThanOrEqual(rect.width * 1.05);
  });

  it('短い学名は縮小しない', () => {
    const ctx = new FakeCtx(600, 800);
    drawLabel(ctx, rect, '#123a63', { ...fields, title: 'Rosa' });
    const size = Number(/(\d+(?:\.\d+)?)px/.exec(ctx.calls[0]?.font ?? '')?.[1]);
    expect(size).toBe(Math.max(14, rect.height * 0.155));
  });

  it('罫を1本引く', () => {
    const ctx = new FakeCtx(600, 800);
    drawLabel(ctx, rect, '#123a63', fields);
    expect(ctx.calls.filter((c) => c.op === 'stroke')).toHaveLength(1);
  });

  it('和名が空なら描かない', () => {
    const ctx = new FakeCtx(600, 800);
    drawLabel(ctx, rect, '#123a63', { ...fields, subtitle: '   ' });
    expect(ctx.calls.filter((c) => c.op === 'fillText').map((c) => c.text)).not.toContain('ワラビ');
  });
});

describe('現在地の取得', () => {
  function geo(behavior: 'success' | 'error' | 'silent'): GeolocationLike {
    return {
      getCurrentPosition(success, error) {
        if (behavior === 'success') {
          success({ coords: { latitude: 35.6812, longitude: 139.7671 } } as GeolocationPosition);
        } else if (behavior === 'error') {
          error({ code: 1 } as GeolocationPositionError);
        }
        // silent: どちらも呼ばない（許可プロンプトを放置した状況）
      },
    };
  }

  it('成功すると座標を返す', async () => {
    await expect(getCurrentPosition(geo('success'))).resolves.toEqual({ lat: 35.6812, lon: 139.7671 });
  });

  it('拒否は日本語のメッセージになる', async () => {
    await expect(getCurrentPosition(geo('error'))).rejects.toThrow('許可されませんでした');
  });

  it('未対応の環境を伝える', async () => {
    await expect(getCurrentPosition(undefined)).rejects.toThrow('対応していません');
  });

  it('応答が来ない場合も独自の締め切りで戻る（FR-404.2）', async () => {
    vi.useFakeTimers();
    try {
      const promise = getCurrentPosition(geo('silent'), 1000);
      const assertion = expect(promise).rejects.toThrow('応答がありませんでした');
      await vi.advanceTimersByTimeAsync(1100);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('成功後に締め切りが発火しても二重解決しない', async () => {
    vi.useFakeTimers();
    try {
      const result = await getCurrentPosition(geo('success'), 1000);
      expect(result.lat).toBeCloseTo(35.6812);
      await vi.advanceTimersByTimeAsync(2000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('エラーコードごとに文言が変わる', () => {
    const messages = [1, 2, 3, 99].map((code) => mapGeoError({ code } as GeolocationPositionError));
    expect(new Set(messages).size).toBe(4);
  });
});
