/**
 * アプリ状態の遷移（SPEC 3.1 / PLAN 3.5）。
 *
 * すべて純関数で、新しい状態を返す（NFR-007.3）。UI を起動せずに
 * 「ソースを往復しても復元される」「編集済みのラベルは上書きされない」を
 * 検証できるようにするため、この規則を描画側ではなくここへ置く。
 */

import type { AppState, LabelFieldKey, LabelFields, PosterSource, SourceKind } from '../types';
import type { SpecimenSource, UploadSource } from '../source/types';
import { specimenById } from '../specimens';
import { specimenNoForSeed } from '../label/specimenId';

export const INK_PRESET_DEFAULT = 'classic';

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  const d = `${now.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createInitialState(now: Date = new Date()): AppState {
  return {
    source: { active: null, upload: null, specimen: null },
    contrast: 20,
    threshold: 128,
    inkPresetId: INK_PRESET_DEFAULT,
    mottle: 55,
    grain: 40,
    vignette: 45,
    edgeStyle: 'rough',
    layout: 'vertical',
    label: {
      title: '',
      subtitle: '',
      locality: '',
      lat: '',
      lon: '',
      date: todayISO(now),
      specimenNo: '',
    },
    labelTouched: [],
  };
}

export function patchState(state: AppState, patch: Partial<AppState>): AppState {
  return { ...state, ...patch };
}

/* -------------------------------------------------------------------------- */
/* 図案ソース                                                                  */
/* -------------------------------------------------------------------------- */

/** 現在有効な図案ソース。未選択なら null。 */
export function activeSource(state: AppState): PosterSource | null {
  const { active, upload, specimen } = state.source;
  if (active === 'upload' && upload) {
    const { kind, image, width, height, fileName } = upload;
    return { kind, image, width, height, fileName };
  }
  if (active === 'specimen' && specimen) {
    return { kind: 'specimen', specimenId: specimen.specimenId };
  }
  return null;
}

/** 現在有効なシード（質感・図案の個体差を駆動する）。 */
export function activeSeed(state: AppState): number {
  const { active, upload, specimen } = state.source;
  if (active === 'upload' && upload) return upload.seed;
  if (active === 'specimen' && specimen) return specimen.seed;
  return 0;
}

export function hasSource(state: AppState): boolean {
  return activeSource(state) !== null;
}

/** アップロード画像を採り込む。 */
export function setUpload(
  state: AppState,
  upload: Omit<UploadSource, 'kind'>,
  seed: number,
  specimenNo: string,
): AppState {
  const next: AppState = {
    ...state,
    source: { ...state.source, active: 'upload', upload: { kind: 'upload', ...upload, seed } },
  };
  // 標本番号は自動採番の項目なので、ユーザーが触っていなければ更新する
  return applyLabelDefaults(next, { specimenNo });
}

/** 所蔵標本を選ぶ。ラベルの既定値も（未編集の項目にだけ）投入する（FR-127）。 */
export function selectSpecimen(state: AppState, specimenId: string, seed: number): AppState {
  const specimen = specimenById(specimenId);
  if (!specimen) return state;

  const source: SpecimenSource & { seed: number } = { kind: 'specimen', specimenId, seed };
  const next: AppState = { ...state, source: { ...state.source, active: 'specimen', specimen: source } };

  return applyLabelDefaults(next, {
    title: specimen.scientificName,
    subtitle: specimen.commonName,
    locality: specimen.locality,
    specimenNo: specimenNoForSeed(seed),
  });
}

/** 選択中の所蔵標本を、種はそのままに別個体へ差し替える（FR-125）。 */
export function reseedSpecimen(state: AppState, seed: number): AppState {
  const current = state.source.specimen;
  if (!current) return state;
  const next: AppState = {
    ...state,
    source: { ...state.source, active: 'specimen', specimen: { ...current, seed } },
  };
  // 再抽選では種が変わらないので、更新するのは標本番号だけ（FR-125.2）
  return applyLabelDefaults(next, { specimenNo: specimenNoForSeed(seed) });
}

/**
 * 図案ソースの系統を切り替える。
 * 切り替え先が未設定なら、選択は行われない（空の状態へ落とさない）。
 */
export function switchSourceKind(state: AppState, kind: SourceKind): AppState {
  if (kind === 'upload' && !state.source.upload) {
    return { ...state, source: { ...state.source, active: null } };
  }
  if (kind === 'specimen' && !state.source.specimen) {
    return { ...state, source: { ...state.source, active: null } };
  }
  return { ...state, source: { ...state.source, active: kind } };
}

/* -------------------------------------------------------------------------- */
/* ラベル                                                                      */
/* -------------------------------------------------------------------------- */

/** ユーザーによる編集。以後この項目は自動投入されない（FR-127.1）。 */
export function editLabel(state: AppState, key: LabelFieldKey, value: string): AppState {
  return {
    ...state,
    label: { ...state.label, [key]: value },
    labelTouched: state.labelTouched.includes(key) ? state.labelTouched : [...state.labelTouched, key],
  };
}

/**
 * アプリが自動で入れる値（現在地の座標など）。編集済みの扱いにはしない
 * ——ユーザーがボタンを押して入れた値なので、その後の自動投入で
 * 上書きされないよう touched として記録する。
 */
export function fillLabelByAction(state: AppState, patch: Partial<LabelFields>): AppState {
  const keys = Object.keys(patch) as LabelFieldKey[];
  const touched = [...state.labelTouched];
  for (const key of keys) if (!touched.includes(key)) touched.push(key);
  return { ...state, label: { ...state.label, ...patch }, labelTouched: touched };
}

/** 未編集の項目にだけ既定値を入れる。 */
export function applyLabelDefaults(state: AppState, defaults: Partial<LabelFields>): AppState {
  const label = { ...state.label };
  for (const [key, value] of Object.entries(defaults) as Array<[LabelFieldKey, string]>) {
    if (state.labelTouched.includes(key)) continue;
    label[key] = value;
  }
  return { ...state, label };
}

export function isLabelTouched(state: AppState, key: LabelFieldKey): boolean {
  return state.labelTouched.includes(key);
}
