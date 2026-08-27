/**
 * @vitest-environment jsdom
 *
 * 画面上のボタン操作（現在地取得・書き出し）の一巡。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootHarness, byId, settle, type Harness } from './harness';
import { checkedRadioValue, clearStatus, el, radios, setStatus } from '../../src/ui/dom';
import { domCanvasFactory } from '../../src/core/ctx2d';

let harness: Harness;

beforeEach(async () => {
  URL.createObjectURL = vi.fn(() => 'blob:stub');
  URL.revokeObjectURL = vi.fn();
  HTMLCanvasElement.prototype.toBlob = function toBlob(callback: BlobCallback) {
    callback(new Blob(['x'], { type: 'image/png' }));
  } as HTMLCanvasElement['toBlob'];
  harness = await bootHarness();
  await settle();
  const fern = document.querySelector<HTMLInputElement>('.plate[data-specimen="fern"] input');
  fern!.checked = true;
  fern!.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function stubGeolocation(behavior: 'ok' | 'denied'): void {
  Object.defineProperty(navigator, 'geolocation', {
    value: {
      getCurrentPosition(success: PositionCallback, error: PositionErrorCallback) {
        if (behavior === 'ok') {
          success({ coords: { latitude: 43.1907, longitude: 142.4661 } } as GeolocationPosition);
        } else {
          error({ code: 1 } as GeolocationPositionError);
        }
      },
    },
    configurable: true,
  });
}

async function clickAndSettle(id: string): Promise<void> {
  byId<HTMLButtonElement>(id).click();
  for (let i = 0; i < 4; i++) await settle();
}

describe('現在地の取得（FR-404）', () => {
  it('成功すると座標欄が埋まり、結果を知らせる', async () => {
    stubGeolocation('ok');
    await clickAndSettle('btnGeolocate');

    expect(byId<HTMLInputElement>('fieldLat').value).toBe('43.1907');
    expect(byId<HTMLInputElement>('fieldLon').value).toBe('142.4661');
    expect(byId('geoStatus').dataset['tone']).toBe('success');
    expect(byId<HTMLButtonElement>('btnGeolocate').disabled).toBe(false);
  });

  it('取得した座標は、以後の標本選択で上書きされない', async () => {
    stubGeolocation('ok');
    await clickAndSettle('btnGeolocate');

    const ginkgo = document.querySelector<HTMLInputElement>('.plate[data-specimen="ginkgo"] input');
    ginkgo!.checked = true;
    ginkgo!.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();

    expect(byId<HTMLInputElement>('fieldLat').value).toBe('43.1907');
  });

  it('拒否されるとエラーを出し、ボタンは戻る（FR-603）', async () => {
    stubGeolocation('denied');
    await clickAndSettle('btnGeolocate');

    expect(byId('geoStatus').dataset['tone']).toBe('error');
    expect(byId('geoStatus').textContent).toContain('許可されませんでした');
    expect(byId<HTMLButtonElement>('btnGeolocate').disabled).toBe(false);
    expect(byId<HTMLInputElement>('fieldLat').value).toBe('');
  });
});

describe('書き出し（FR-504）', () => {
  it('完了すると結果を知らせ、ボタンが戻る', async () => {
    const original = HTMLAnchorElement.prototype.click;
    const downloads: string[] = [];
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
      downloads.push(this.download);
    };
    try {
      await clickAndSettle('btnExport');
    } finally {
      HTMLAnchorElement.prototype.click = original;
    }

    expect(downloads).toHaveLength(1);
    expect(byId('exportStatus').dataset['tone']).toBe('success');
    expect(byId<HTMLButtonElement>('btnExport').disabled).toBe(false);
  });

  it('失敗しても無言で終わらせず、ボタンを戻す（FR-603）', async () => {
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback: BlobCallback) {
      callback(null);
    } as HTMLCanvasElement['toBlob'];

    await clickAndSettle('btnExport');

    expect(byId('exportStatus').dataset['tone']).toBe('error');
    expect(byId('exportStatus').textContent).toContain('PNG');
    expect(byId<HTMLButtonElement>('btnExport').disabled).toBe(false);
  });

  it('倍率を変えると前回の結果表示が消える', async () => {
    await clickAndSettle('btnExport');
    expect(byId('exportStatus').hidden).toBe(false);

    const scale = document.querySelector<HTMLInputElement>('input[name="scale"][value="3"]');
    scale!.checked = true;
    scale!.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();

    expect(byId('exportStatus').hidden).toBe(true);
  });

  it('図案ソースが無ければ何もしない', async () => {
    byId<HTMLButtonElement>('tabUpload').click();
    await settle();
    expect(harness.state().source.active).toBeNull();

    byId<HTMLButtonElement>('btnExport').click();
    await settle();
    expect(byId('exportStatus').hidden).toBe(true);
  });
});

describe('DOM ヘルパ', () => {
  it('存在しない ID は起動時点で分かるように投げる', () => {
    expect(() => el('nonexistent')).toThrow('要素が見つかりません');
  });

  it('ラジオ群をまとめて取れる', () => {
    expect(radios('scale')).toHaveLength(3);
    expect(radios('nonexistent')).toHaveLength(0);
  });

  it('選択中の値を取り、無ければ既定へ落ちる', () => {
    expect(checkedRadioValue('scale', '2')).toBe('2');
    expect(checkedRadioValue('nonexistent', 'fallback')).toBe('fallback');
  });

  it('状態表示を出して消せる', () => {
    const node = byId('exportStatus');
    setStatus(node, 'テスト', 'error');
    expect(node.hidden).toBe(false);
    expect(node.dataset['tone']).toBe('error');

    setStatus(node, '情報');
    expect(node.dataset['tone']).toBe('');

    clearStatus(node);
    expect(node.hidden).toBe(true);
    expect(node.textContent).toBe('');
  });

  it('ブラウザ既定のキャンバス生成が動く', () => {
    const { canvas } = domCanvasFactory(20, 30);
    expect(canvas.width).toBe(20);
    expect(canvas.height).toBe(30);
  });
});
