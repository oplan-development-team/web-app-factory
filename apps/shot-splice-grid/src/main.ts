import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/motion.css';

import { getState, hasBothImages, setState } from './state';
import { initDropzones, swapSlots, clearAllSlots } from './ui/dropzone';
import {
  attachOverlapInteractions,
  getCurrentPair,
  refreshPair,
  renderPreview,
  setScanning,
  showEmptyOrStage,
} from './ui/preview';
import {
  els,
  setAnyImageControlsEnabled,
  setPairControlsEnabled,
  setStatus,
  updateCostReadout,
  updateCropReadouts,
  updateOutputReadout,
  updateOverlapReadout,
  updateSegmented,
} from './ui/controls';
import { detectOverlap } from './core/alignment';
import { composeNormal, computeOutputSize } from './core/compose';

const appEl = document.getElementById('app') as HTMLDivElement;

let rafHandle: number | null = null;

function draw(): void {
  renderPreview();
  const pair = getCurrentPair();
  const s = getState();
  if (pair) {
    const size = computeOutputSize(pair, s.overlapPx);
    updateOutputReadout(size.width, size.height);
  } else {
    updateOutputReadout(null, null);
  }
}

function scheduleDraw(): void {
  if (rafHandle !== null) return;
  rafHandle = requestAnimationFrame(() => {
    rafHandle = null;
    draw();
  });
}

function syncControlsFromState(): void {
  const s = getState();
  updateOverlapReadout(s.overlapPx, s.maxOverlapPx);
  updateCropReadouts(s.topCut, s.bottomCut);
  updateCostReadout(s.lastDetectionCost);
  updateSegmented(s.frontLayer, s.diffMode);
}

function updateAppState(): void {
  const s = getState();
  const count = Number(s.topImage !== null) + Number(s.bottomImage !== null);
  appEl.dataset.state = count === 0 ? 'empty' : count === 1 ? 'partial' : 'ready';
}

function handleImagesChanged(): void {
  const ready = hasBothImages();
  refreshPair();
  showEmptyOrStage();
  updateAppState();
  setPairControlsEnabled(ready);
  setAnyImageControlsEnabled(getState().topImage !== null || getState().bottomImage !== null);
  syncControlsFromState();
  if (ready) {
    draw();
    setStatus('2枚の画像を読み込みました。AUTO DETECTで自動位置合わせ、またはプレビューをドラッグして手動調整できます。', 'success');
  } else {
    updateOutputReadout(null, null);
  }
}

function setOverlap(next: number): void {
  setState({ overlapPx: next });
  scheduleDraw();
  updateOverlapReadout(next, getState().maxOverlapPx);
}

async function runAutoDetect(): Promise<void> {
  const pair = getCurrentPair();
  if (!pair) return;
  els.autoDetectBtn.disabled = true;
  setScanning(true);
  setStatus('スキャン中…', 'info');
  // Yield one frame so the scanning animation actually paints before the
  // (fast but synchronous) search runs on the main thread.
  await new Promise((resolve) => requestAnimationFrame(resolve));
  try {
    const result = detectOverlap(pair.top, pair.bottom);
    setState({ overlapPx: result.overlapPx, lastDetectionCost: result.cost, maxOverlapPx: result.maxOverlapPx });
    syncControlsFromState();
    draw();
    setStatus(`一致点を検出しました（Δ${result.cost.toFixed(2)}）。数値が0に近いほど精度が高い状態です。`, 'success');
  } catch {
    setStatus('自動検出に失敗しました。手動で重なり量を調整してください。', 'error');
  } finally {
    setScanning(false);
    els.autoDetectBtn.disabled = false;
  }
}

function downloadComposite(): void {
  const pair = getCurrentPair();
  if (!pair) return;
  const s = getState();
  const canvas = composeNormal(pair, s.overlapPx, s.frontLayer);
  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus('PNG書き出しに失敗しました。', 'error');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shot-splice-grid.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('PNGをダウンロードしました。', 'success');
  }, 'image/png');
}

function wireOverlapControls(): void {
  els.overlapInput.addEventListener('change', () => {
    const pair = getCurrentPair();
    const max = pair ? pair.maxOverlapPx : getState().maxOverlapPx;
    const parsed = Number.parseInt(els.overlapInput.value, 10);
    const clamped = Number.isFinite(parsed) ? Math.max(0, Math.min(max, parsed)) : getState().overlapPx;
    setOverlap(clamped);
  });

  for (const btn of els.stepperBtns) {
    btn.addEventListener('click', () => {
      const pair = getCurrentPair();
      if (!pair) return;
      const step = Number.parseInt(btn.dataset.step ?? '0', 10);
      const next = Math.max(0, Math.min(pair.maxOverlapPx, getState().overlapPx + step));
      setOverlap(next);
    });
  }

  els.autoDetectBtn.addEventListener('click', () => void runAutoDetect());
}

function wireCropControls(): void {
  const handleCropInput = () => {
    const topCut = Math.max(0, Number.parseInt(els.topCutInput.value, 10) || 0);
    const bottomCut = Math.max(0, Number.parseInt(els.bottomCutInput.value, 10) || 0);
    setState({ topCut, bottomCut });
    refreshPair();
    syncControlsFromState();
    draw();
  };
  els.topCutInput.addEventListener('change', handleCropInput);
  els.bottomCutInput.addEventListener('change', handleCropInput);
}

function wireSegmentedControls(): void {
  els.frontTopBtn.addEventListener('click', () => {
    setState({ frontLayer: 'top' });
    syncControlsFromState();
    draw();
  });
  els.frontBottomBtn.addEventListener('click', () => {
    setState({ frontLayer: 'bottom' });
    syncControlsFromState();
    draw();
  });
  els.viewNormalBtn.addEventListener('click', () => {
    setState({ diffMode: false });
    syncControlsFromState();
    draw();
  });
  els.viewDiffBtn.addEventListener('click', () => {
    setState({ diffMode: true });
    syncControlsFromState();
    draw();
  });
}

function wireActions(): void {
  els.downloadBtn.addEventListener('click', downloadComposite);
  els.swapBtn.addEventListener('click', () => swapSlots(handleImagesChanged));
  els.clearBtn.addEventListener('click', () => {
    clearAllSlots(handleImagesChanged);
    setStatus('すべてクリアしました。', 'info');
  });
}

function init(): void {
  initDropzones(handleImagesChanged);
  attachOverlapInteractions(setOverlap);
  wireOverlapControls();
  wireCropControls();
  wireSegmentedControls();
  wireActions();
  updateAppState();
  syncControlsFromState();
}

init();
