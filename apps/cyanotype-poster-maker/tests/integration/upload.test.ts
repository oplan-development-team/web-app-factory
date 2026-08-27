/**
 * @vitest-environment jsdom
 *
 * 持ち込み標本の経路（読み込み・拒否・書き出し・ドロップ操作）。
 * jsdom には画像デコードも toBlob も無いので、そこだけ差し替えて
 * 残りは本物のコードを通す。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootHarness, byId, settle, type Harness } from './harness';
import { MAX_IMAGE_EDGE, checkImageSize, loadImageFile } from '../../src/source/imageLoader';
import { exportPoster } from '../../src/ui/exportImage';
import { Stage } from '../../src/ui/stage';
import type { RenderParams } from '../../src/core/compose';

let harness: Harness;
const originalImage = globalThis.Image;

/** 読み込みの成否と寸法を指定できる Image のスタブ。 */
function stubImage(behavior: 'load' | 'error', width = 800, height = 600): void {
  class StubImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = width;
    naturalHeight = height;
    width = width;
    height = height;
    set src(_value: string) {
      queueMicrotask(() => {
        if (behavior === 'load') this.onload?.();
        else this.onerror?.();
      });
    }
  }
  globalThis.Image = StubImage as unknown as typeof Image;
}

function fakeFile(name: string, type: string): File {
  return {
    name,
    type,
    size: 2048,
    lastModified: 1,
    slice: () => ({ arrayBuffer: async (): Promise<ArrayBuffer> => new ArrayBuffer(16) }),
  } as unknown as File;
}

beforeEach(async () => {
  URL.createObjectURL = vi.fn(() => 'blob:stub');
  URL.revokeObjectURL = vi.fn();
  harness = await bootHarness();
  await settle();
  byId<HTMLButtonElement>('tabUpload').click();
  await settle();
});

afterEach(() => {
  globalThis.Image = originalImage;
  vi.restoreAllMocks();
});

async function drop(file: File): Promise<void> {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files: [file] } });
  byId('dropzone').dispatchEvent(event);
  await settle();
  await settle();
}

describe('画像の読み込み', () => {
  it('JPEG を受け取ると図案ソースになる（AC-02）', async () => {
    stubImage('load', 1200, 900);
    await drop(fakeFile('photo.jpg', 'image/jpeg'));

    expect(harness.state().source.active).toBe('upload');
    expect(harness.state().source.upload?.fileName).toBe('photo.jpg');
    expect(byId('stageEmpty').hidden).toBe(true);
    expect(byId<HTMLButtonElement>('btnExport').disabled).toBe(false);
  });

  it('寸法と結果を知らせる（FR-604）', async () => {
    stubImage('load', 1200, 900);
    await drop(fakeFile('photo.jpg', 'image/jpeg'));
    const status = byId('uploadStatus');
    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain('1200×900');
    expect(status.dataset['tone']).toBe('success');
  });

  it('標本番号が自動で入る（FR-111）', async () => {
    stubImage('load');
    await drop(fakeFile('photo.jpg', 'image/jpeg'));
    expect(byId<HTMLInputElement>('fieldSpecimenNo').value).toMatch(/^\d{4}\.\d{4}\.[A-Z]$/);
  });

  it('対応しない形式は拒否し、状態を壊さない（AC-03）', async () => {
    stubImage('load');
    await drop(fakeFile('doc.pdf', 'application/pdf'));

    expect(harness.state().source.active).toBeNull();
    const status = byId('uploadStatus');
    expect(status.dataset['tone']).toBe('error');
    expect(status.textContent).toContain('JPEGまたはPNG');
    expect(byId('stageEmpty').hidden).toBe(false);
  });

  it('復号に失敗した場合もエラーを出す（FR-110.3）', async () => {
    stubImage('error');
    await drop(fakeFile('broken.png', 'image/png'));
    expect(byId('uploadStatus').textContent).toContain('破損');
    expect(harness.state().source.active).toBeNull();
  });

  it('大きすぎる画像を拒否する（FR-110.4）', async () => {
    stubImage('load', MAX_IMAGE_EDGE + 500, 100);
    await drop(fakeFile('huge.jpg', 'image/jpeg'));
    expect(byId('uploadStatus').textContent).toContain('大きすぎます');
    expect(harness.state().source.active).toBeNull();
  });

  it('読み込み後は進行表示が消える', async () => {
    stubImage('load');
    await drop(fakeFile('photo.jpg', 'image/jpeg'));
    expect(byId('stageLoading').hidden).toBe(true);
  });

  it('拒否されたあとでも、続けて正しい画像を読める', async () => {
    stubImage('load');
    await drop(fakeFile('doc.pdf', 'application/pdf'));
    await drop(fakeFile('photo.jpg', 'image/jpeg'));
    expect(harness.state().source.active).toBe('upload');
  });

  it('Object URL を必ず解放する', async () => {
    stubImage('load');
    await drop(fakeFile('photo.jpg', 'image/jpeg'));
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('復号失敗時も Object URL を解放する', async () => {
    stubImage('error');
    await drop(fakeFile('broken.png', 'image/png'));
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('loadImageFile は寸法を読めない画像も拒否する', async () => {
    stubImage('load', 0, 0);
    await expect(loadImageFile(fakeFile('empty.png', 'image/png'))).rejects.toThrow('寸法');
  });

  it('checkImageSize の判定と一致する', () => {
    expect(checkImageSize(1200, 900).ok).toBe(true);
  });
});

describe('ドロップゾーンの操作', () => {
  it('dragover でハイライトし、dragleave で戻る', () => {
    const zone = byId('dropzone');
    zone.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    expect(zone.classList.contains('is-dragover')).toBe(true);
    zone.dispatchEvent(new Event('dragleave', { bubbles: true }));
    expect(zone.classList.contains('is-dragover')).toBe(false);
  });

  it('クリックでファイル選択を開く', () => {
    const input = byId<HTMLInputElement>('fileInput');
    const spy = vi.spyOn(input, 'click');
    byId('dropzone').click();
    expect(spy).toHaveBeenCalled();
  });

  it('Enter / Space でもファイル選択を開く（FR-110.1）', () => {
    const input = byId<HTMLInputElement>('fileInput');
    const spy = vi.spyOn(input, 'click');
    for (const key of ['Enter', ' ']) {
      byId('dropzone').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('他のキーでは開かない', () => {
    const spy = vi.spyOn(byId<HTMLInputElement>('fileInput'), 'click');
    byId('dropzone').dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(spy).not.toHaveBeenCalled();
  });

  it('ファイルの無いドロップでは何も起きない', async () => {
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { files: [] } });
    byId('dropzone').dispatchEvent(event);
    await settle();
    expect(harness.state().source.active).toBeNull();
  });
});

describe('書き出し（AC-14）', () => {
  function params(): RenderParams {
    return {
      source: { kind: 'specimen', specimenId: 'fern' },
      seed: 1,
      contrast: 20,
      threshold: 128,
      inkPresetId: 'classic',
      mottle: 55,
      grain: 40,
      vignette: 45,
      edgeStyle: 'rough',
      layout: 'vertical',
      label: {
        title: 'Pteridium aquilinum',
        subtitle: '',
        locality: '',
        lat: '',
        lon: '',
        date: '2026-08-27',
        specimenNo: '2026.1234.A',
      },
    };
  }

  function stubToBlob(blob: Blob | null): void {
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback: BlobCallback) {
      callback(blob);
    } as HTMLCanvasElement['toBlob'];
  }

  it('指定倍率の寸法で描き、PNG をダウンロードさせる', async () => {
    stubToBlob(new Blob(['x'], { type: 'image/png' }));
    const clicks: string[] = [];
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
      clicks.push(this.download);
    };

    try {
      await exportPoster(params(), 2);
    } finally {
      HTMLAnchorElement.prototype.click = original;
    }

    expect(clicks).toEqual(['cyanotype-2026.1234.A.png']);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('PNG を作れなければエラーを投げる', async () => {
    stubToBlob(null);
    await expect(exportPoster(params(), 1)).rejects.toThrow('PNGの生成に失敗');
  });
});

describe('ステージの進行表示', () => {
  it('メッセージを出してから消せる', () => {
    const nodes = {
      canvas: byId<HTMLCanvasElement>('previewCanvas'),
      empty: byId('stageEmpty'),
      loading: byId('stageLoading'),
      loadingText: byId('stageLoadingText'),
    };
    const stage = new Stage(nodes, () => null);

    stage.showLoading('感光処理中…');
    expect(nodes.loading.hidden).toBe(false);
    expect(nodes.loadingText.textContent).toBe('感光処理中…');

    stage.hideLoading();
    expect(nodes.loading.hidden).toBe(true);
  });

  it('ソースが無ければ描かずに空状態を出す', () => {
    const nodes = {
      canvas: byId<HTMLCanvasElement>('previewCanvas'),
      empty: byId('stageEmpty'),
      loading: byId('stageLoading'),
      loadingText: byId('stageLoadingText'),
    };
    const stage = new Stage(nodes, () => null);
    stage.renderNow();
    expect(stage.renders).toBe(0);
    expect(nodes.empty.hidden).toBe(false);
  });

  it('フレームを譲れる（FR-602.1）', async () => {
    const stage = new Stage(
      {
        canvas: byId<HTMLCanvasElement>('previewCanvas'),
        empty: byId('stageEmpty'),
        loading: byId('stageLoading'),
        loadingText: byId('stageLoadingText'),
      },
      () => null,
    );
    await expect(stage.yieldFrame()).resolves.toBeUndefined();
  });
});
