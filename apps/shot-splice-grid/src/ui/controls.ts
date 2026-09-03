import type { FrontLayer } from '../core/types';

export const els = {
  overlapInput: document.getElementById('overlap-input') as HTMLInputElement,
  autoDetectBtn: document.getElementById('auto-detect-btn') as HTMLButtonElement,
  costReadout: document.getElementById('cost-readout') as HTMLParagraphElement,
  stepperBtns: Array.from(document.querySelectorAll<HTMLButtonElement>('.stepper-btn')),
  topCutInput: document.getElementById('top-cut-input') as HTMLInputElement,
  bottomCutInput: document.getElementById('bottom-cut-input') as HTMLInputElement,
  frontTopBtn: document.getElementById('front-top-btn') as HTMLButtonElement,
  frontBottomBtn: document.getElementById('front-bottom-btn') as HTMLButtonElement,
  viewNormalBtn: document.getElementById('view-normal-btn') as HTMLButtonElement,
  viewDiffBtn: document.getElementById('view-diff-btn') as HTMLButtonElement,
  outputWidth: document.getElementById('output-width') as HTMLSpanElement,
  outputHeight: document.getElementById('output-height') as HTMLSpanElement,
  downloadBtn: document.getElementById('download-btn') as HTMLButtonElement,
  swapBtn: document.getElementById('swap-btn') as HTMLButtonElement,
  clearBtn: document.getElementById('clear-btn') as HTMLButtonElement,
  statusLine: document.getElementById('status-line') as HTMLParagraphElement,
};

const PAIR_CONTROLS: (HTMLButtonElement | HTMLInputElement)[] = [
  els.overlapInput,
  els.autoDetectBtn,
  els.topCutInput,
  els.bottomCutInput,
  els.frontTopBtn,
  els.frontBottomBtn,
  els.viewNormalBtn,
  els.viewDiffBtn,
  els.downloadBtn,
];

export function setPairControlsEnabled(enabled: boolean): void {
  for (const el of PAIR_CONTROLS) el.disabled = !enabled;
  for (const btn of els.stepperBtns) btn.disabled = !enabled;
}

export function setAnyImageControlsEnabled(enabled: boolean): void {
  els.swapBtn.disabled = !enabled;
  els.clearBtn.disabled = !enabled;
}

export function updateOverlapReadout(value: number, max: number): void {
  els.overlapInput.value = String(value);
  els.overlapInput.max = String(max);
}

export function updateCropReadouts(topCut: number, bottomCut: number): void {
  if (document.activeElement !== els.topCutInput) els.topCutInput.value = String(topCut);
  if (document.activeElement !== els.bottomCutInput) els.bottomCutInput.value = String(bottomCut);
}

export function updateCostReadout(cost: number | null): void {
  els.costReadout.textContent = cost === null ? '—' : `Δ COST ${cost.toFixed(2)}`;
}

export function updateSegmented(frontLayer: FrontLayer, diffMode: boolean): void {
  els.frontTopBtn.classList.toggle('is-active', frontLayer === 'top');
  els.frontTopBtn.setAttribute('aria-pressed', String(frontLayer === 'top'));
  els.frontBottomBtn.classList.toggle('is-active', frontLayer === 'bottom');
  els.frontBottomBtn.setAttribute('aria-pressed', String(frontLayer === 'bottom'));

  els.viewNormalBtn.classList.toggle('is-active', !diffMode);
  els.viewNormalBtn.setAttribute('aria-pressed', String(!diffMode));
  els.viewDiffBtn.classList.toggle('is-active', diffMode);
  els.viewDiffBtn.setAttribute('aria-pressed', String(diffMode));
}

export function updateOutputReadout(width: number | null, height: number | null): void {
  els.outputWidth.textContent = width === null ? '—' : String(width);
  els.outputHeight.textContent = height === null ? '—' : String(height);
}

let statusTimer: number | undefined;

export function setStatus(message: string, tone: 'info' | 'success' | 'error' = 'info'): void {
  window.clearTimeout(statusTimer);
  els.statusLine.textContent = message;
  els.statusLine.dataset.tone = tone;
  if (message) {
    statusTimer = window.setTimeout(() => {
      els.statusLine.textContent = '';
    }, 4000);
  }
}
