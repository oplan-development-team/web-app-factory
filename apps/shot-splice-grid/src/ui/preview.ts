import { getState, setState } from '../state';
import { buildWorkingPair, composeDiff, composeNormal, computeOutputSize, type WorkingPair } from '../core/compose';

const ARROW_STEP = 1;
const ARROW_STEP_SHIFT = 10;

let currentPair: WorkingPair | null = null;

const stageEl = document.getElementById('preview-stage') as HTMLDivElement;
const scrollEl = document.getElementById('preview-scroll') as HTMLDivElement;
const canvasEl = document.getElementById('preview-canvas') as HTMLCanvasElement;
const seamTopEl = document.getElementById('seam-line-top') as HTMLDivElement;
const seamBottomEl = document.getElementById('seam-line-bottom') as HTMLDivElement;
const seamReadoutEl = document.getElementById('seam-readout') as HTMLDivElement;
const seamReadoutValueEl = document.getElementById('seam-readout-value') as HTMLSpanElement;
const sweepEl = document.getElementById('scan-sweep') as HTMLDivElement;

export function getCurrentPair(): WorkingPair | null {
  return currentPair;
}

/** Rebuilds the working pair from source images + crops, then redraws the composite. */
export function refreshPair(): void {
  const s = getState();
  if (!s.topImage || !s.bottomImage) {
    currentPair = null;
    return;
  }
  currentPair = buildWorkingPair(s.topImage, s.bottomImage, s.topCut, s.bottomCut);
  const clampedOverlap = Math.max(0, Math.min(s.overlapPx, currentPair.maxOverlapPx));
  if (clampedOverlap !== s.overlapPx || currentPair.maxOverlapPx !== s.maxOverlapPx) {
    setState({ overlapPx: clampedOverlap, maxOverlapPx: currentPair.maxOverlapPx });
  }
}

/** Redraws the visible canvas + seam guides from the current pair and state, without rebuilding it. */
export function renderPreview(): void {
  const s = getState();
  if (!currentPair) return;

  const composed = s.diffMode
    ? composeDiff(currentPair, s.overlapPx)
    : composeNormal(currentPair, s.overlapPx, s.frontLayer);

  canvasEl.width = composed.width;
  canvasEl.height = composed.height;
  const ctx = canvasEl.getContext('2d');
  if (ctx) ctx.drawImage(composed, 0, 0);

  const size = computeOutputSize(currentPair, s.overlapPx);
  const clampedOverlap = Math.max(0, Math.min(s.overlapPx, currentPair.maxOverlapPx));
  const seamTop = currentPair.top.height - clampedOverlap;
  const seamBottom = currentPair.top.height;
  const topPct = (seamTop / size.height) * 100;
  const bottomPct = (seamBottom / size.height) * 100;
  seamTopEl.style.top = `${topPct}%`;
  seamBottomEl.style.top = `${bottomPct}%`;
  seamReadoutEl.style.top = `${(topPct + bottomPct) / 2}%`;
  seamReadoutValueEl.textContent = String(clampedOverlap);
}

export function showEmptyOrStage(): void {
  const s = getState();
  const dropzonesEl = document.getElementById('dropzones') as HTMLDivElement;
  const ready = s.topImage !== null && s.bottomImage !== null;
  stageEl.hidden = !ready;
  dropzonesEl.hidden = ready;
}

export function setScanning(active: boolean): void {
  if (active) {
    const stagePadding = parseFloat(getComputedStyle(stageEl).paddingTop) || 16;
    const distance = Math.max(0, stageEl.clientHeight - stagePadding * 2 - 3);
    sweepEl.style.setProperty('--sweep-distance', `${distance}px`);
  }
  sweepEl.hidden = !active;
  stageEl.classList.toggle('is-scanning', active);
}

function clientToOverlapDelta(deltaYClient: number): number {
  const displayedHeight = canvasEl.getBoundingClientRect().height || 1;
  const scale = canvasEl.height / displayedHeight;
  return Math.round(deltaYClient * scale);
}

export function attachOverlapInteractions(onOverlapChange: (next: number) => void): void {
  let dragging = false;
  let startY = 0;
  let startOverlap = 0;

  scrollEl.addEventListener('pointerdown', (e) => {
    if (!currentPair) return;
    dragging = true;
    startY = e.clientY;
    startOverlap = getState().overlapPx;
    scrollEl.setPointerCapture(e.pointerId);
    stageEl.classList.add('is-dragging');
  });

  scrollEl.addEventListener('pointermove', (e) => {
    if (!dragging || !currentPair) return;
    const deltaClient = e.clientY - startY;
    const deltaOverlap = clientToOverlapDelta(deltaClient);
    const next = Math.max(0, Math.min(currentPair.maxOverlapPx, startOverlap - deltaOverlap));
    onOverlapChange(next);
  });

  const endDrag = () => {
    dragging = false;
    stageEl.classList.remove('is-dragging');
  };
  scrollEl.addEventListener('pointerup', endDrag);
  scrollEl.addEventListener('pointercancel', endDrag);

  stageEl.addEventListener('keydown', (e) => {
    if (!currentPair) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const step = e.shiftKey ? ARROW_STEP_SHIFT : ARROW_STEP;
    const direction = e.key === 'ArrowUp' ? 1 : -1;
    const next = Math.max(0, Math.min(currentPair.maxOverlapPx, getState().overlapPx + direction * step));
    onOverlapChange(next);
  });
}
