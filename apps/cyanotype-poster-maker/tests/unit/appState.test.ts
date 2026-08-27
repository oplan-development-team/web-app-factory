import { describe, expect, it } from 'vitest';
import {
  activeSeed,
  activeSource,
  applyLabelDefaults,
  createInitialState,
  editLabel,
  fillLabelByAction,
  hasSource,
  isLabelTouched,
  patchState,
  reseedSpecimen,
  selectSpecimen,
  setUpload,
  switchSourceKind,
  todayISO,
} from '../../src/state/appState';
import { SPECIMENS } from '../../src/specimens';
import type { AppState } from '../../src/types';

const image = { naturalWidth: 800, naturalHeight: 600 } as HTMLImageElement;

function withUpload(state: AppState): AppState {
  return setUpload(state, { image, width: 800, height: 600, fileName: 'photo.jpg' }, 4242, '2026.1234.A');
}

describe('初期状態', () => {
  it('図案ソースは未選択（FR-102 / AC-01）', () => {
    const state = createInitialState();
    expect(state.source.active).toBeNull();
    expect(hasSource(state)).toBe(false);
    expect(activeSource(state)).toBeNull();
    expect(activeSeed(state)).toBe(0);
  });

  it('採集日に今日が入る', () => {
    expect(createInitialState(new Date(2026, 7, 27)).label.date).toBe('2026-08-27');
  });

  it('todayISO は 0 埋めする', () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('ラベルは未編集扱いで始まる', () => {
    expect(createInitialState().labelTouched).toEqual([]);
  });
});

describe('不変更新', () => {
  it('patchState は元の状態を壊さない', () => {
    const state = createInitialState();
    const next = patchState(state, { contrast: 90 });
    expect(state.contrast).toBe(20);
    expect(next.contrast).toBe(90);
  });

  it('editLabel は元の label を壊さない', () => {
    const state = createInitialState();
    const next = editLabel(state, 'title', 'Rosa');
    expect(state.label.title).toBe('');
    expect(next.label.title).toBe('Rosa');
    expect(state.labelTouched).toEqual([]);
  });
});

describe('アップロード', () => {
  it('採り込むと有効なソースになる', () => {
    const state = withUpload(createInitialState());
    expect(state.source.active).toBe('upload');
    expect(hasSource(state)).toBe(true);
    expect(activeSource(state)?.kind).toBe('upload');
    expect(activeSeed(state)).toBe(4242);
  });

  it('標本番号が自動で入る', () => {
    expect(withUpload(createInitialState()).label.specimenNo).toBe('2026.1234.A');
  });

  it('ユーザーが標本番号を編集済みなら上書きしない', () => {
    const edited = editLabel(createInitialState(), 'specimenNo', 'MY-001');
    expect(withUpload(edited).label.specimenNo).toBe('MY-001');
  });
});

describe('所蔵標本の選択', () => {
  const fern = SPECIMENS[0];

  it('選ぶと有効なソースになる', () => {
    const state = selectSpecimen(createInitialState(), 'fern', 99);
    expect(state.source.active).toBe('specimen');
    expect(activeSource(state)).toEqual({ kind: 'specimen', specimenId: 'fern' });
    expect(activeSeed(state)).toBe(99);
  });

  it('未知の id は無視される', () => {
    const state = createInitialState();
    expect(selectSpecimen(state, 'nope', 1)).toBe(state);
  });

  it('ラベルの既定値が入る（FR-127 / AC-08）', () => {
    const state = selectSpecimen(createInitialState(), 'fern', 1);
    expect(state.label.title).toBe(fern?.scientificName);
    expect(state.label.subtitle).toBe(fern?.commonName);
    expect(state.label.locality).toBe(fern?.locality);
    expect(state.label.specimenNo).not.toBe('');
  });

  it('編集済みの項目は上書きしない（FR-127.1 / AC-08）', () => {
    const edited = editLabel(createInitialState(), 'locality', '自分で書いた産地');
    const state = selectSpecimen(edited, 'fern', 1);
    expect(state.label.locality).toBe('自分で書いた産地');
    // 未編集の項目には入る
    expect(state.label.title).toBe(fern?.scientificName);
  });

  it('別の標本へ乗り換えると既定値が更新される', () => {
    const first = selectSpecimen(createInitialState(), 'fern', 1);
    const second = selectSpecimen(first, 'ginkgo', 2);
    expect(second.label.title).toBe(SPECIMENS.find((s) => s.id === 'ginkgo')?.scientificName);
  });

  it('自動投入は touched を増やさない', () => {
    expect(selectSpecimen(createInitialState(), 'fern', 1).labelTouched).toEqual([]);
  });
});

describe('別個体の採取（再抽選）', () => {
  it('種は変わらず、シードだけ変わる（FR-125 / AC-06）', () => {
    const first = selectSpecimen(createInitialState(), 'algae', 11);
    const second = reseedSpecimen(first, 22);
    expect(second.source.specimen?.specimenId).toBe('algae');
    expect(activeSeed(second)).toBe(22);
  });

  it('標本番号が更新される（FR-125.1）', () => {
    const first = selectSpecimen(createInitialState(), 'algae', 11);
    const second = reseedSpecimen(first, 22);
    expect(second.label.specimenNo).not.toBe(first.label.specimenNo);
  });

  it('学名・和名・産地は再抽選で変わらない', () => {
    const first = selectSpecimen(createInitialState(), 'algae', 11);
    const second = reseedSpecimen(first, 22);
    expect(second.label.title).toBe(first.label.title);
    expect(second.label.locality).toBe(first.label.locality);
  });

  it('編集済みの標本番号は再抽選でも守られる（FR-125.2）', () => {
    const first = selectSpecimen(createInitialState(), 'algae', 11);
    const edited = editLabel(first, 'specimenNo', 'KEEP-1');
    expect(reseedSpecimen(edited, 22).label.specimenNo).toBe('KEEP-1');
  });

  it('所蔵標本が未選択なら何も起きない', () => {
    const state = createInitialState();
    expect(reseedSpecimen(state, 5)).toBe(state);
  });
});

describe('ソースの往復（AC-09）', () => {
  it('切り替えても両方の状態が保たれ、戻せば復元される', () => {
    let state = withUpload(createInitialState());
    state = selectSpecimen(state, 'umbel', 7);
    expect(state.source.active).toBe('specimen');
    expect(state.source.upload).not.toBeNull();

    state = switchSourceKind(state, 'upload');
    expect(state.source.active).toBe('upload');
    expect(activeSeed(state)).toBe(4242);
    expect(state.source.specimen?.specimenId).toBe('umbel');

    state = switchSourceKind(state, 'specimen');
    expect(activeSource(state)).toEqual({ kind: 'specimen', specimenId: 'umbel' });
    expect(activeSeed(state)).toBe(7);
  });

  it('未設定の系統へ切り替えると未選択になる', () => {
    const state = switchSourceKind(createInitialState(), 'specimen');
    expect(state.source.active).toBeNull();
    expect(hasSource(state)).toBe(false);
  });

  it('未設定の系統へ切り替えても、既存の選択は消えない', () => {
    let state = selectSpecimen(createInitialState(), 'fern', 1);
    state = switchSourceKind(state, 'upload');
    expect(state.source.specimen?.specimenId).toBe('fern');
    state = switchSourceKind(state, 'specimen');
    expect(hasSource(state)).toBe(true);
  });
});

describe('ラベルの自動投入規則', () => {
  it('applyLabelDefaults は未編集の項目にだけ入る', () => {
    const state = editLabel(createInitialState(), 'title', '手書き');
    const next = applyLabelDefaults(state, { title: '既定', subtitle: '既定サブ' });
    expect(next.label.title).toBe('手書き');
    expect(next.label.subtitle).toBe('既定サブ');
  });

  it('操作による投入は以後の自動投入から守られる', () => {
    let state = fillLabelByAction(createInitialState(), { lat: '35.6812', lon: '139.7671' });
    expect(isLabelTouched(state, 'lat')).toBe(true);
    state = applyLabelDefaults(state, { lat: '0' });
    expect(state.label.lat).toBe('35.6812');
  });

  it('同じ項目を二度編集しても touched が重複しない', () => {
    let state = editLabel(createInitialState(), 'title', 'a');
    state = editLabel(state, 'title', 'ab');
    expect(state.labelTouched.filter((k) => k === 'title')).toHaveLength(1);
  });

  it('空文字への編集も編集として扱う', () => {
    const state = editLabel(selectSpecimen(createInitialState(), 'fern', 1), 'locality', '');
    expect(selectSpecimen(state, 'ginkgo', 2).label.locality).toBe('');
  });
});
