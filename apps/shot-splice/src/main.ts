import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/sheet.css';
import './styles/motion.css';

import { MATCH_COST_THRESHOLD } from './core/alignment';
import { computeLayout } from './core/layout';
import type { FrontLayer, Layout } from './core/types';
import { composeCanvas, seamView, type ShotSource } from './imaging/compose';
import { type CanvasLike, context2d, createCanvas } from './imaging/surface';
import {
  createAnalyzer,
  cutsEqual,
  detectBands,
  detectSeam,
  scoreOverlap,
  workingGrays,
} from './ui/analysis';
import { createAppShell } from './ui/app-shell';
import { createBandCard } from './ui/band-card';
import { createConfirmSheet } from './ui/confirm-sheet';
import { el, frameThrottle } from './ui/dom';
import { exportPng } from './ui/export';
import { createShots, intakeMessage, sortByName } from './ui/intake';
import { createReel } from './ui/reel';
import { createSeamRow } from './ui/seam-row';
import { createSeamSheet } from './ui/seam-sheet';
import { createStage } from './ui/stage';
import { createUndoToast } from './ui/undo-toast';
import {
  MAX_SHOTS,
  addShots,
  applyBandDetection,
  baseWidth,
  clearShots,
  createStore,
  effectiveCuts,
  hasMixedWidths,
  moveShot,
  removeShot,
  seamList,
  setActiveSeam,
  setBusy,
  setDiffMode,
  setStatus,
  updateBands,
  updateSeam,
  type AppState,
  type SeamState,
} from './ui/store';
import { createToolbar } from './ui/toolbar';

/** Cap on canvas pixels along one axis; some browsers refuse taller surfaces. */
const MAX_CANVAS_DIM = 8192;
/** How many image rows either side of the band the seam crop may reach for. */
const LOUPE_WINDOW_PX = 300;
/** Physical height of the seam crop, in CSS pixels. */
const LOUPE_HEIGHT_CSS = 170;
/** Never magnify past this, or the crop stops showing enough context. */
const MAX_LOUPE_ZOOM = 3;

const store = createStore();
const analyzer = createAnalyzer();
const shell = createAppShell();
const dpr = () => Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2);

function currentLayout(state: AppState): Layout | null {
  if (state.shots.length === 0) return null;
  const width = baseWidth(state);
  const sizes = state.shots.map((shot) => ({
    width,
    height: Math.max(1, Math.round((shot.naturalHeight * width) / Math.max(1, shot.naturalWidth))),
  }));
  return computeLayout(
    sizes,
    seamList(state).map((seam) => seam.overlapPx),
    effectiveCuts(state.bands),
  );
}

let grayCache: { key: string; cuts: ReturnType<typeof effectiveCuts>; grays: ReturnType<typeof workingGrays> } | null =
  null;

function cutGrays(state: AppState, layout: Layout) {
  const key = state.shots.map((shot) => shot.id).join(',');
  const cuts = effectiveCuts(state.bands);
  if (grayCache && grayCache.key === key && cutsEqual(grayCache.cuts, cuts)) return grayCache.grays;
  const grays = workingGrays(analyzer, state.shots, baseWidth(state), layout);
  grayCache = { key, cuts, grays };
  return grays;
}

/**
 * Re-measures a seam at the overlap the user just chose.
 *
 * Without this the seam keeps advertising the cost of the *detected* overlap,
 * so dragging a perfectly matched seam apart leaves it still labelled "一致".
 */
function rescore(state: AppState, index: number, overlapPx: number): Partial<SeamState> {
  const layout = currentLayout(state);
  if (!layout) return { overlapPx };
  const grays = cutGrays(state, layout);
  const upper = grays[index];
  const lower = grays[index + 1];
  if (!upper || !lower) return { overlapPx };
  const cost = scoreOverlap(upper, lower, overlapPx);
  return { overlapPx, cost, matched: cost !== null && cost <= MATCH_COST_THRESHOLD };
}

function sourcesOf(state: AppState): ShotSource[] {
  return state.shots.map((shot) => ({
    source: shot.source,
    naturalWidth: shot.naturalWidth,
    naturalHeight: shot.naturalHeight,
  }));
}

function frontsOf(state: AppState): FrontLayer[] {
  return seamList(state).map((seam) => seam.front);
}

/**
 * Draws the whole splice into the sticky stage at fit-width.
 *
 * The stage never renders at full resolution: a twelve-shot splice is tens of
 * thousands of pixels tall, well past what a browser will allocate, and the
 * overview does not need that detail.
 */
function paintStage(canvas: HTMLCanvasElement, width: number, height: number): void {
  const state = store.getState();
  const layout = currentLayout(state);
  if (!layout || width <= 0 || height <= 0) return;

  const frame = canvas.parentElement;
  const cssWidth = Math.max(1, frame?.clientWidth ?? width);
  let scale = (cssWidth / width) * dpr();
  if (height * scale > MAX_CANVAS_DIM) scale = MAX_CANVAS_DIM / height;

  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${Math.round((height * cssWidth) / width)}px`;
  composeCanvas(sourcesOf(state), layout, {
    fronts: frontsOf(state),
    scale,
    background: '#0b0c10',
    factory: () => canvas as unknown as CanvasLike,
  });
}

/**
 * Draws one seam at no less than 1:1 device pixels and returns how many CSS
 * pixels one image pixel occupies, so the drag handler can move the image
 * exactly as far as the finger.
 *
 * Never below 1:1: at fit-width a phone screenshot is squeezed by 3x or more,
 * and a one-pixel misalignment — the thing this view exists to expose — would
 * be averaged out of existence. Sources narrower than the sheet are magnified
 * instead of being left floating in dead space, and magnification is drawn
 * with smoothing off so single-pixel errors stay hard-edged.
 */
function paintLoupe(canvas: HTMLCanvasElement, index: number, diff: boolean): number {
  const state = store.getState();
  const layout = currentLayout(state);
  const ratio = dpr();
  if (!layout) return 1 / ratio;

  const view = seamView(sourcesOf(state), layout, index, {
    fronts: frontsOf(state),
    diff,
    contextPx: LOUPE_WINDOW_PX,
    background: '#0b0c10',
  });
  if (!view) return 1 / ratio;

  const frame = canvas.parentElement;
  const cssWidth = Math.max(1, frame?.clientWidth ?? 320);
  const deviceWidth = Math.round(cssWidth * ratio);
  const zoom = Math.max(1, Math.min(MAX_LOUPE_ZOOM, deviceWidth / view.canvas.width));

  // Keep the crop a consistent physical height whatever the zoom.
  const windowPx = Math.max(
    1,
    Math.min(view.canvas.height, Math.round((LOUPE_HEIGHT_CSS * ratio) / zoom)),
  );
  const focus = view.bandY + Math.min(view.bandHeight, windowPx) / 2;
  const sy = Math.max(0, Math.min(view.canvas.height - windowPx, Math.round(focus - windowPx / 2)));
  const sw = Math.min(Math.round(deviceWidth / zoom), view.canvas.width);
  const sx = Math.max(0, Math.round((view.canvas.width - sw) / 2));

  canvas.width = Math.round(sw * zoom);
  canvas.height = Math.round(windowPx * zoom);
  canvas.style.width = `${canvas.width / ratio}px`;
  canvas.style.height = `${canvas.height / ratio}px`;

  const ctx = context2d(canvas as unknown as CanvasLike);
  ctx.imageSmoothingEnabled = zoom === 1;
  ctx.drawImage(view.canvas, sx, sy, sw, windowPx, 0, 0, canvas.width, canvas.height);

  // Mark where the shared band begins and ends within this crop.
  const band = canvas.parentElement?.querySelector<HTMLElement>('.loupe__band');
  if (band) {
    band.style.transform = `translateY(${((view.bandY - sy) * zoom) / ratio}px)`;
    band.style.height = `${(view.bandHeight * zoom) / ratio}px`;
    band.hidden = view.bandHeight <= 0;
  }
  return zoom / ratio;
}

const stage = createStage({ paint: paintStage });
const bandCard = createBandCard({
  onToggle: (enabled) => store.update((s) => updateBands(s, { enabled })),
  onEdit: (patch) => store.update((s) => updateBands(s, { ...patch, manuallyEdited: true })),
  onTrimEnds: (trimEnds) => store.update((s) => updateBands(s, { trimEnds })),
  onAdopt: () =>
    store.update((s) =>
      updateBands(s, {
        headerPx: s.bands.detectedHeaderPx,
        footerPx: s.bands.detectedFooterPx,
        manuallyEdited: false,
      }),
    ),
});

const seamRows = new Map<number, ReturnType<typeof createSeamRow>>();
function seamRowFor(index: number): HTMLElement {
  let row = seamRows.get(index);
  if (!row) {
    row = createSeamRow(index, (i) => store.update((s) => setActiveSeam(s, i)));
    seamRows.set(index, row);
  }
  return row.element;
}

/** The state to restore if the most recent single-shot delete is undone. */
let pendingRemoval: AppState | null = null;

const undoToast = createUndoToast({
  onUndo: () => {
    if (!pendingRemoval) return;
    store.set(pendingRemoval);
    pendingRemoval = null;
  },
});

const reel = createReel({
  onMove: (from, to) => store.update((s) => moveShot(s, from, to)),
  onRemove: (id) => {
    const before = store.getState();
    const shot = before.shots.find((s) => s.id === id);
    if (!shot) return;
    analyzer.forget(id);
    pendingRemoval = before;
    store.update((s) => removeShot(s, id));
    undoToast.show(`${shot.name} を削除しました。`);
  },
  renderSeam: seamRowFor,
});

const sheet = createSeamSheet({
  onOverlap: (index, value) =>
    store.update((s) => updateSeam(s, index, rescore(s, index, clampOverlap(s, index, value)))),
  onFront: (index, front) => store.update((s) => updateSeam(s, index, { front })),
  onDiff: (diff) => store.update((s) => setDiffMode(s, diff)),
  onRedetect: (index) => void detectRange(index, index + 1),
  onClose: () => store.update((s) => setActiveSeam(s, null)),
  paint: paintLoupe,
});

const confirmSheet = createConfirmSheet();

const toolbar = createToolbar({
  onAdd: (files) => void intake(files),
  onDetectAll: () => void detectRange(0, store.getState().shots.length - 1),
  onExport: () => void save(),
  onClear: () => {
    if (store.getState().shots.length === 0) return;
    confirmSheet.open({
      title: 'すべて削除しますか？',
      message: '読み込んだショットをすべて削除します。この操作は元に戻せません。',
      confirmLabel: '削除する',
      onConfirm: () => {
        analyzer.clear();
        seamRows.clear();
        pendingRemoval = null;
        undoToast.dismiss();
        store.update((s) => setStatus(clearShots(s), { tone: 'info', message: 'すべて削除しました。' }));
      },
    });
  },
});

function clampOverlap(state: AppState, index: number, value: number): number {
  const layout = currentLayout(state);
  const max = layout?.maxOverlaps[index] ?? seamList(state)[index]?.maxOverlapPx ?? 0;
  return Math.max(0, Math.min(max, Math.round(value)));
}

/** Yields to the browser so a long detection run still paints its progress. */
const nextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

async function detectRange(from: number, to: number): Promise<void> {
  const start = store.getState();
  const total = Math.max(0, Math.min(to, start.shots.length - 1) - from);
  if (total <= 0) return;

  store.update((s) => setBusy(s, { kind: 'detecting', done: 0, total }));
  await nextFrame();

  let unmatched = 0;
  for (let i = from; i < from + total; i += 1) {
    const state = store.getState();
    const layout = currentLayout(state);
    if (!layout) break;
    const grays = cutGrays(state, layout);
    const upper = grays[i];
    const lower = grays[i + 1];
    if (!upper || !lower) continue;

    const result = detectSeam(upper, lower);
    if (!result.matched) unmatched += 1;
    store.update((s) =>
      setBusy(
        updateSeam(s, i, {
          overlapPx: result.matched ? result.overlapPx : 0,
          maxOverlapPx: result.maxOverlapPx,
          // A rejected candidate's cost describes an offset that was thrown
          // away; reporting it next to an overlap of 0 would put a precise
          // number against a measurement that was never taken.
          cost: result.matched ? result.cost : null,
          matched: result.matched,
        }),
        { kind: 'detecting', done: i - from + 1, total },
      ),
    );
    await nextFrame();
  }

  store.update((s) =>
    setStatus(setBusy(s, { kind: 'idle' }), {
      tone: unmatched > 0 ? 'error' : 'success',
      message:
        unmatched > 0
          ? `${total}箇所を検出し、${unmatched}箇所は重なりが見つかりませんでした。該当の継ぎ目を開いて手動で合わせてください。`
          : `${total}箇所の継ぎ目を合わせました。`,
    }),
  );
}

async function intake(files: readonly File[]): Promise<void> {
  if (files.length === 0) return;
  store.update((s) => setBusy(s, { kind: 'loading', message: `${files.length}枚を読み込み中` }));
  await nextFrame();

  const before = store.getState();
  const { shots, skipped } = await createShots(sortByName([...files]));
  const { state, rejected } = addShots(before, shots);

  const message = intakeMessage(state.shots.length - before.shots.length, skipped, rejected.length, MAX_SHOTS);
  const mixed = hasMixedWidths(state);
  store.set(
    setStatus(setBusy(state, { kind: 'idle' }), {
      tone: message?.tone ?? 'success',
      message: `${message?.message ?? ''}${
        mixed ? `幅の異なる画像が含まれるため、先頭の幅（${baseWidth(state)}px）に合わせて拡縮します。` : ''
      }`.trim(),
    }),
  );
  refreshBands();
}

function refreshBands(): void {
  const state = store.getState();
  if (state.shots.length < 2) return;
  const detection = detectBands(analyzer, state.shots, baseWidth(state));
  store.update((s) => applyBandDetection(s, detection));
}

async function save(): Promise<void> {
  const state = store.getState();
  const layout = currentLayout(state);
  if (!layout || state.shots.length < 2) return;

  store.update((s) => setBusy(s, { kind: 'exporting' }));
  await nextFrame();
  try {
    const filename = await exportPng(sourcesOf(state), layout, frontsOf(state), {
      factory: createCanvas,
    });
    store.update((s) =>
      setStatus(setBusy(s, { kind: 'idle' }), {
        tone: 'success',
        message: `${filename} を保存しました。`,
      }),
    );
  } catch (error) {
    store.update((s) =>
      setStatus(setBusy(s, { kind: 'idle' }), {
        tone: 'error',
        message: error instanceof Error ? error.message : 'PNGの書き出しに失敗しました。',
      }),
    );
  }
}

function render(): void {
  const state = store.getState();
  const layout = currentLayout(state);
  shell.root.dataset.shots = String(state.shots.length);
  stage.update(state, layout);
  reel.update(state);
  seamList(state).forEach((seam, index) => {
    seamRowFor(index);
    seamRows.get(index)?.update({
      ...seam,
      overlapPx: layout?.overlaps[index] ?? seam.overlapPx,
      maxOverlapPx: layout?.maxOverlaps[index] ?? seam.maxOverlapPx,
    });
  });
  bandCard.update(state);
  toolbar.update(state);
  sheet.update(state);
  shell.setStatus(state.status);
}

const scheduleRender = frameThrottle(render);

function wireDropTarget(): void {
  let depth = 0;
  const stop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  document.addEventListener('dragenter', (event) => {
    stop(event);
    depth += 1;
    shell.setDragActive(true);
  });
  document.addEventListener('dragover', stop);
  document.addEventListener('dragleave', (event) => {
    stop(event);
    depth = Math.max(0, depth - 1);
    if (depth === 0) shell.setDragActive(false);
  });
  document.addEventListener('drop', (event) => {
    stop(event);
    depth = 0;
    shell.setDragActive(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) void intake(files);
  });
}

function boot(): void {
  const mount = document.getElementById('app');
  if (!mount) return;

  const empty = el('div', { class: 'empty' }, [
    el('button', {
      class: 'btn btn--primary btn--wide',
      type: 'button',
      text: 'スクリーンショットを選ぶ',
      on: { click: () => toolbar.openPicker() },
    }),
    el('p', {
      class: 'empty__hint',
      text: 'ドラッグ&ドロップでも追加できます。最大12枚まで。',
    }),
  ]);

  shell.main.append(stage.element, empty, reel.element, bandCard.element, toolbar.element);
  mount.append(shell.root, sheet.element, confirmSheet.element, undoToast.element);

  store.subscribe(scheduleRender);
  wireDropTarget();
  window.addEventListener('resize', scheduleRender);
  render();
}

boot();
