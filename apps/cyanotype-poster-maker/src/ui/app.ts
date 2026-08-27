import { collectElements, checkedRadioValue, clearStatus, setStatus, type Elements } from './dom';
import { Stage } from './stage';
import { IntakeTabs, bindDropzone } from './intake';
import { PlateBook } from './plateBook';
import { bindInkSwatches, bindLabelForm, bindSliders, bindToggles } from './wiring';
import { exportPoster } from './exportImage';
import { ImageLoadError, loadImageFile } from '../source/imageLoader';
import { analyzeFile } from '../label/specimenId';
import { getCurrentPosition } from '../label/geolocation';
import { formatCoordinate } from '../label/coordinates';
import { SPECIMENS } from '../specimens';
import { mulberry32 } from '../core/random';
import type { RenderParams } from '../core/compose';
import type { AppState, LabelFieldKey, SourceKind } from '../types';
import {
  activeSeed,
  activeSource,
  createInitialState,
  editLabel,
  fillLabelByAction,
  hasSource,
  patchState,
  reseedSpecimen,
  selectSpecimen,
  setUpload,
  switchSourceKind,
} from '../state/appState';

/** 所蔵標本ごとの現在のシード。図案帳のサムネイルはこれで描く（FR-126）。 */
function initialSeeds(): Map<string, number> {
  const seeds = new Map<string, number>();
  // 起動ごとに違う個体が並ぶと、同じ図案帳という感じがしない。
  // 一覧の初期状態は固定シードにして、変わるのは「別個体を採取」したときだけにする。
  SPECIMENS.forEach((specimen, index) => seeds.set(specimen.id, 1000 + index * 7717));
  return seeds;
}

export function bootstrap(): void {
  const elements = collectElements();
  let state: AppState = createInitialState();
  const seeds = initialSeeds();
  const rollRandom = mulberry32(Date.now() & 0xffffffff);

  const paramsOf = (): RenderParams => ({
    source: activeSource(state),
    seed: activeSeed(state),
    contrast: state.contrast,
    threshold: state.threshold,
    inkPresetId: state.inkPresetId,
    mottle: state.mottle,
    grain: state.grain,
    vignette: state.vignette,
    edgeStyle: state.edgeStyle,
    layout: state.layout,
    label: state.label,
  });

  const stage = new Stage(
    {
      canvas: elements.previewCanvas,
      empty: elements.stageEmpty,
      loading: elements.stageLoading,
      loadingText: elements.stageLoadingText,
    },
    paramsOf,
  );

  const plateBook = new PlateBook({
    container: elements.plateBook,
    onSelect: (specimenId) => chooseSpecimen(specimenId),
    seedFor: (specimenId) => seeds.get(specimenId) ?? 0,
    inkPresetId: () => state.inkPresetId,
  });

  /* ---------- 状態の反映 ---------- */

  function commit(next: AppState, options: { redrawLabel?: boolean } = {}): void {
    const previous = state;
    state = next;

    if (options.redrawLabel !== false) syncLabelInputs();
    if (hasSource(state) !== hasSource(previous)) revealCards(hasSource(state));

    elements.btnExport.disabled = !hasSource(state);
    elements.btnReseed.disabled = state.source.specimen === null;
    plateBook.setSelected(state.source.specimen?.specimenId ?? null);

    stage.schedule();
  }

  function revealCards(visible: boolean): void {
    for (const card of elements.revealCards) card.hidden = !visible;
  }

  function syncLabelInputs(): void {
    const map: Array<[LabelFieldKey, HTMLInputElement]> = [
      ['title', elements.fieldTitle],
      ['subtitle', elements.fieldSubtitle],
      ['locality', elements.fieldLocality],
      ['lat', elements.fieldLat],
      ['lon', elements.fieldLon],
      ['date', elements.fieldDate],
      ['specimenNo', elements.fieldSpecimenNo],
    ];
    for (const [key, input] of map) {
      const value = state.label[key];
      // 入力中の欄を書き戻すとカーソルが飛ぶので、差があるときだけ触る
      if (input.value !== value) input.value = value;
    }
  }

  /* ---------- 所蔵標本 ---------- */

  function chooseSpecimen(specimenId: string): void {
    const seed = seeds.get(specimenId) ?? 0;
    commit(selectSpecimen(state, specimenId, seed));
    clearStatus(elements.archiveStatus);
  }

  function reseed(): void {
    const current = state.source.specimen;
    if (!current) return;
    const seed = Math.floor(rollRandom() * 0xffffffff) >>> 0;
    seeds.set(current.specimenId, seed);
    commit(reseedSpecimen(state, seed));
    // 変わったのは 1 枚だけなので、6 枚を焼き直さない（FR-606）
    plateBook.renderOne(current.specimenId);
    setStatus(elements.archiveStatus, `別個体を採取しました（${state.label.specimenNo}）`, 'success');
  }

  elements.btnReseed.addEventListener('click', reseed);

  /* ---------- 持ち込み ---------- */

  async function handleFile(file: File): Promise<void> {
    stage.showLoading('標本を感光処理しています…');
    // 進行表示が実際に描かれてから重い処理へ入る（FR-602.1）
    await stage.yieldFrame();
    try {
      const [image, analysis] = await Promise.all([loadImageFile(file), analyzeFile(file)]);
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;

      commit(
        setUpload(state, { image, width, height, fileName: file.name }, analysis.seed, analysis.specimenNo),
      );
      setStatus(elements.uploadStatus, `${file.name}（${width}×${height}px）を採取しました`, 'success');
    } catch (error) {
      const message = error instanceof ImageLoadError ? error.message : '画像の読み込みに失敗しました';
      setStatus(elements.uploadStatus, message, 'error');
    } finally {
      stage.hideLoading();
    }
  }

  bindDropzone({ dropzone: elements.dropzone, fileInput: elements.fileInput }, (file) => void handleFile(file));

  /* ---------- 系統の切り替え ---------- */

  const tabs = new IntakeTabs(
    {
      tabArchive: elements.tabArchive,
      tabUpload: elements.tabUpload,
      paneArchive: elements.paneArchive,
      paneUpload: elements.paneUpload,
    },
    (kind: SourceKind) => commit(switchSourceKind(state, kind)),
  );

  /* ---------- 調整・ラベル・書き出し ---------- */

  bindSliders(elements, (patch) => commit(patchState(state, patch), { redrawLabel: false }));
  bindToggles((patch) => commit(patchState(state, patch), { redrawLabel: false }));
  bindInkSwatches(elements, state.inkPresetId, (inkPresetId) => {
    commit(patchState(state, { inkPresetId }), { redrawLabel: false });
    // 図案帳のサムネイルも同じインクで描かれているので追従させる
    plateBook.renderAll();
  });
  bindLabelForm(elements, (key, value) => commit(editLabel(state, key, value), { redrawLabel: false }));

  elements.btnGeolocate.addEventListener('click', () => void locate());

  async function locate(): Promise<void> {
    elements.btnGeolocate.disabled = true;
    setStatus(elements.geoStatus, '現在地を取得しています…');
    try {
      const position = await getCurrentPosition();
      const lat = formatCoordinate(position.lat);
      const lon = formatCoordinate(position.lon);
      commit(fillLabelByAction(state, { lat, lon }));
      setStatus(elements.geoStatus, `取得しました（${lat}, ${lon}）`, 'success');
    } catch (error) {
      setStatus(elements.geoStatus, error instanceof Error ? error.message : '位置情報の取得に失敗しました', 'error');
    } finally {
      elements.btnGeolocate.disabled = false;
    }
  }

  elements.btnExport.addEventListener('click', () => void runExport());

  async function runExport(): Promise<void> {
    if (!hasSource(state)) return;
    elements.btnExport.disabled = true;
    setStatus(elements.exportStatus, '高解像度で書き出しています…');
    await stage.yieldFrame();
    try {
      await exportPoster(paramsOf(), Number(checkedRadioValue('scale', '2')));
      setStatus(elements.exportStatus, 'PNGを書き出しました', 'success');
    } catch (error) {
      setStatus(elements.exportStatus, error instanceof Error ? error.message : '書き出しに失敗しました', 'error');
    } finally {
      elements.btnExport.disabled = false;
    }
  }

  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="scale"]')) {
    input.addEventListener('change', () => clearStatus(elements.exportStatus));
  }

  /* ---------- 起動 ---------- */

  elements.fieldDate.value = state.label.date;
  revealCards(false);
  plateBook.renderAll();
  stage.showEmpty();
  void ensureFontsReady(elements, stage);

  // テスト・E2E から状態を覗くための最小の口
  Object.defineProperty(window, '__cyanotype', {
    value: { state: (): AppState => state, tabs, plateBook, stage },
    configurable: true,
  });
}

/**
 * Web フォントの読み込みを待ってから初回描画する。
 * 取得に失敗してもシステムフォントで全機能が動く（NFR-001.2）。
 */
async function ensureFontsReady(elements: Elements, stage: Stage): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('italic 500 40px "EB Garamond"'),
      document.fonts.load('400 40px "EB Garamond"'),
      document.fonts.load('400 40px "Special Elite"'),
    ]);
    await document.fonts.ready;
  } catch {
    // システムフォントへ静かに縮退する
  }
  elements.previewCanvas.dataset['fontsReady'] = 'true';
  stage.schedule();
}
