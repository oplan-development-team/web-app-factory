/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { bootHarness, byId, fireInput, settle, type Harness } from './harness';
import { SPECIMENS } from '../../src/specimens';

let harness: Harness;

beforeEach(async () => {
  harness = await bootHarness();
  await settle();
});

function plateInput(id: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(`.plate[data-specimen="${id}"] input`);
  if (!input) throw new Error(`図案が見つかりません: ${id}`);
  return input;
}

function selectPlate(id: string): void {
  const input = plateInput(id);
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('起動直後（AC-01）', () => {
  it('図案ソースは未選択で、空状態が出ている', () => {
    expect(harness.state().source.active).toBeNull();
    expect(byId('stageEmpty').hidden).toBe(false);
  });

  it('書き出しと再抽選は無効', () => {
    expect(byId<HTMLButtonElement>('btnExport').disabled).toBe(true);
    expect(byId<HTMLButtonElement>('btnReseed').disabled).toBe(true);
  });

  it('調整カードは伏せられている（FR-104）', () => {
    for (const id of ['cardTone', 'cardInk', 'cardTexture', 'cardLayout', 'cardLabel', 'cardExport']) {
      expect(byId(id).hidden, id).toBe(true);
    }
  });

  it('既定は所蔵標本のタブ', () => {
    expect(byId('tabArchive').getAttribute('aria-selected')).toBe('true');
    expect(byId('paneArchive').hidden).toBe(false);
    expect(byId('paneUpload').hidden).toBe(true);
  });
});

describe('図案帳（AC-04）', () => {
  it('登録簿の全種が並ぶ', () => {
    expect(document.querySelectorAll('.plate')).toHaveLength(SPECIMENS.length);
    for (const specimen of SPECIMENS) {
      expect(document.querySelector(`.plate[data-specimen="${specimen.id}"]`), specimen.id).not.toBeNull();
    }
  });

  it('各項目にサムネイル用のキャンバスがある', () => {
    expect(document.querySelectorAll('.plate canvas')).toHaveLength(SPECIMENS.length);
  });

  it('図版番号・学名・和名が出ている', () => {
    const first = SPECIMENS[0];
    const plate = document.querySelector(`.plate[data-specimen="${first?.id}"]`);
    expect(plate?.textContent).toContain(first?.plateNo);
    expect(plate?.textContent).toContain(first?.scientificName);
    expect(plate?.textContent).toContain(first?.label);
  });

  it('ラジオグループとして組まれている（FR-607）', () => {
    expect(byId('plateBook').getAttribute('role')).toBe('radiogroup');
    for (const input of document.querySelectorAll<HTMLInputElement>('.plate input')) {
      expect(input.type).toBe('radio');
      expect(input.name).toBe('specimen');
    }
  });
});

describe('所蔵標本を選ぶ（AC-05, AC-08）', () => {
  beforeEach(async () => {
    selectPlate('fern');
    await settle();
  });

  it('プレビューが描かれ、空状態が消える', () => {
    expect(byId('stageEmpty').hidden).toBe(true);
    expect(Number(byId('previewCanvas').dataset['renderCount'])).toBeGreaterThan(0);
  });

  it('調整カードが開示され、書き出しが有効になる', () => {
    for (const id of ['cardTone', 'cardInk', 'cardTexture', 'cardLayout', 'cardLabel', 'cardExport']) {
      expect(byId(id).hidden, id).toBe(false);
    }
    expect(byId<HTMLButtonElement>('btnExport').disabled).toBe(false);
    expect(byId<HTMLButtonElement>('btnReseed').disabled).toBe(false);
  });

  it('ラベルへ既定値が入る（FR-127）', () => {
    const fern = SPECIMENS.find((s) => s.id === 'fern');
    expect(byId<HTMLInputElement>('fieldTitle').value).toBe(fern?.scientificName);
    expect(byId<HTMLInputElement>('fieldSubtitle').value).toBe(fern?.commonName);
    expect(byId<HTMLInputElement>('fieldLocality').value).toBe(fern?.locality);
    expect(byId<HTMLInputElement>('fieldSpecimenNo').value).not.toBe('');
  });

  it('選択中の項目に印が付く', () => {
    expect(document.querySelector('.plate[data-specimen="fern"]')?.classList.contains('is-selected')).toBe(true);
    expect(document.querySelector('.plate[data-specimen="algae"]')?.classList.contains('is-selected')).toBe(false);
  });

  it('編集済みのラベルは別の標本を選んでも守られる（AC-08）', async () => {
    fireInput(byId<HTMLInputElement>('fieldLocality'), '自分で書いた産地');
    await settle();
    selectPlate('ginkgo');
    await settle();
    expect(byId<HTMLInputElement>('fieldLocality').value).toBe('自分で書いた産地');
    expect(byId<HTMLInputElement>('fieldTitle').value).toBe(
      SPECIMENS.find((s) => s.id === 'ginkgo')?.scientificName,
    );
  });
});

describe('別個体を採取（AC-06）', () => {
  it('種は変わらず、シードと標本番号が変わる', async () => {
    selectPlate('umbel');
    await settle();
    const before = harness.state();

    byId<HTMLButtonElement>('btnReseed').click();
    await settle();
    const after = harness.state();

    expect(after.source.specimen?.specimenId).toBe('umbel');
    expect(after.source.specimen?.seed).not.toBe(before.source.specimen?.seed);
    expect(after.label.specimenNo).not.toBe(before.label.specimenNo);
    expect(byId<HTMLInputElement>('fieldSpecimenNo').value).toBe(after.label.specimenNo);
  });

  it('学名・産地は変わらない', async () => {
    selectPlate('umbel');
    await settle();
    const before = harness.state().label;
    byId<HTMLButtonElement>('btnReseed').click();
    await settle();
    expect(harness.state().label.title).toBe(before.title);
    expect(harness.state().label.locality).toBe(before.locality);
  });

  it('結果を利用者へ知らせる（FR-604）', async () => {
    selectPlate('umbel');
    await settle();
    byId<HTMLButtonElement>('btnReseed').click();
    await settle();
    const status = byId('archiveStatus');
    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain('別個体');
  });
});

describe('系統の切り替え（AC-09）', () => {
  it('持ち込みタブへ移るとペインが入れ替わる', async () => {
    byId<HTMLButtonElement>('tabUpload').click();
    await settle();
    expect(byId('paneUpload').hidden).toBe(false);
    expect(byId('paneArchive').hidden).toBe(true);
    expect(byId('tabUpload').getAttribute('aria-selected')).toBe('true');
  });

  it('アップロード未設定のまま移ると未選択へ戻り、戻せば復元する', async () => {
    selectPlate('grass');
    await settle();
    expect(harness.state().source.active).toBe('specimen');

    byId<HTMLButtonElement>('tabUpload').click();
    await settle();
    expect(harness.state().source.active).toBeNull();
    expect(byId('stageEmpty').hidden).toBe(false);
    // 選択そのものは保持されている
    expect(harness.state().source.specimen?.specimenId).toBe('grass');

    byId<HTMLButtonElement>('tabArchive').click();
    await settle();
    expect(harness.state().source.active).toBe('specimen');
    expect(byId('stageEmpty').hidden).toBe(true);
  });

  it('矢印キーでタブを移動できる（FR-607）', async () => {
    byId<HTMLButtonElement>('tabArchive').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    await settle();
    expect(byId('tabUpload').getAttribute('aria-selected')).toBe('true');
  });

  it('選択中のタブだけが Tab 順に入る', async () => {
    expect(byId<HTMLButtonElement>('tabArchive').tabIndex).toBe(0);
    expect(byId<HTMLButtonElement>('tabUpload').tabIndex).toBe(-1);
    byId<HTMLButtonElement>('tabUpload').click();
    await settle();
    expect(byId<HTMLButtonElement>('tabUpload').tabIndex).toBe(0);
    expect(byId<HTMLButtonElement>('tabArchive').tabIndex).toBe(-1);
  });
});

describe('調整の反映（AC-11）', () => {
  beforeEach(async () => {
    selectPlate('ginkgo');
    await settle();
  });

  it('スライダーが状態と表示へ届く', async () => {
    fireInput(byId<HTMLInputElement>('rangeThreshold'), '175');
    await settle();
    expect(harness.state().threshold).toBe(175);
    expect(byId('outThreshold').textContent).toBe('175');
  });

  it('すべてのスライダーが結線されている', async () => {
    const cases: Array<[string, string, keyof ReturnType<Harness['state']>]> = [
      ['rangeContrast', '-40', 'contrast'],
      ['rangeMottle', '10', 'mottle'],
      ['rangeGrain', '90', 'grain'],
      ['rangeVignette', '5', 'vignette'],
    ];
    for (const [id, value, key] of cases) {
      fireInput(byId<HTMLInputElement>(id), value);
      await settle();
      expect(harness.state()[key], id).toBe(Number(value));
    }
  });

  it('縁とレイアウトの切り替えが届く（AC-12, AC-13）', async () => {
    const straight = document.querySelector<HTMLInputElement>('input[name="edgeStyle"][value="straight"]');
    straight!.checked = true;
    straight!.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(harness.state().edgeStyle).toBe('straight');

    const square = document.querySelector<HTMLInputElement>('input[name="layout"][value="square"]');
    square!.checked = true;
    square!.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(harness.state().layout).toBe('square');
  });

  it('インク色の選択肢が並び、選ぶと状態が変わる', async () => {
    const swatches = document.querySelectorAll<HTMLInputElement>('input[name="inkPreset"]');
    expect(swatches.length).toBeGreaterThan(1);
    const second = swatches[1];
    second!.checked = true;
    second!.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(harness.state().inkPresetId).toBe(second?.value);
  });

  it('再描画は 1 フレームに 1 回へ束ねられる（FR-605）', async () => {
    const before = Number(byId('previewCanvas').dataset['renderCount']);
    const slider = byId<HTMLInputElement>('rangeMottle');
    for (let i = 0; i < 12; i++) fireInput(slider, String(i * 8));
    await settle();
    const after = Number(byId('previewCanvas').dataset['renderCount']);
    expect(after - before).toBe(1);
  });
});

describe('ラベルの編集', () => {
  it('入力が状態へ届く', async () => {
    selectPlate('fern');
    await settle();
    fireInput(byId<HTMLInputElement>('fieldTitle'), 'Rosa rugosa');
    await settle();
    expect(harness.state().label.title).toBe('Rosa rugosa');
  });

  it('入力中の欄を書き戻さない（カーソルが飛ばない）', async () => {
    selectPlate('fern');
    await settle();
    const input = byId<HTMLInputElement>('fieldLocality');
    fireInput(input, '北海');
    await settle();
    expect(input.value).toBe('北海');
  });

  it('採集日に今日が入っている', () => {
    expect(byId<HTMLInputElement>('fieldDate').value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
