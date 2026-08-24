import type { Store } from '../lib/state';
import { buildPosterSvg } from '../lib/poster';
import { contourGlyphSvg, scanGlyphSvg } from './icons';
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from '../lib/constants';

export interface CanvasHandle {
  el: HTMLElement;
  update: () => void;
}

export function createCanvas(store: Store): CanvasHandle {
  const viewport = document.createElement('div');
  viewport.className = 'canvas-viewport';

  const errorBanner = document.createElement('div');
  errorBanner.className = 'error-banner';
  errorBanner.hidden = true;
  errorBanner.innerHTML = `
    <div>
      <span class="label">UPLOAD ERROR</span>
      <p data-role="error-text"></p>
    </div>
    <button type="button" aria-label="閉じる" data-role="dismiss-error">×</button>
  `;
  viewport.appendChild(errorBanner);
  errorBanner.querySelector('[data-role="dismiss-error"]')?.addEventListener('click', () => store.clearError());

  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.innerHTML = `
    ${contourGlyphSvg()}
    <h2>NO SOURCE LOADED</h2>
    <p>被写体の写真をドラッグ＆ドロップするか、下のボタンから選択してください。明暗が等高線の密度に変換されます。</p>
    <button type="button" class="btn btn-primary" data-role="browse">BROWSE FILE</button>
    <div class="spec-line">JPEG · PNG · WEBP — UP TO 10MB</div>
  `;
  viewport.appendChild(emptyState);

  const loadingState = document.createElement('div');
  loadingState.className = 'loading-state';
  loadingState.hidden = true;
  loadingState.innerHTML = `
    ${scanGlyphSvg()}
    <div class="label">TRACING CONTOURS…</div>
    <div class="scan-bar"></div>
  `;
  viewport.appendChild(loadingState);

  const sheetWrap = document.createElement('div');
  sheetWrap.className = 'sheet-wrap';
  sheetWrap.hidden = true;
  viewport.appendChild(sheetWrap);

  const recalcBadge = document.createElement('div');
  recalcBadge.className = 'export-feedback';
  recalcBadge.style.position = 'absolute';
  recalcBadge.style.top = '18px';
  recalcBadge.style.right = '18px';
  recalcBadge.style.margin = '0';
  recalcBadge.style.borderColor = 'var(--ink-soft)';
  recalcBadge.style.color = 'var(--ink-soft)';
  recalcBadge.textContent = 'RECALCULATING…';
  recalcBadge.hidden = true;
  viewport.appendChild(recalcBadge);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = ACCEPTED_TYPES.join(',');
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void store.loadFile(file);
    fileInput.value = '';
  });
  viewport.appendChild(fileInput);

  emptyState.querySelector('[data-role="browse"]')?.addEventListener('click', () => fileInput.click());

  let dragDepth = 0;
  viewport.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  viewport.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth++;
    viewport.classList.add('drag-over');
  });
  viewport.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) viewport.classList.remove('drag-over');
  });
  viewport.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    viewport.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) void store.loadFile(file);
  });

  let mountedSvg: SVGSVGElement | null = null;

  function update(): void {
    const { status, trace, source, errorMessage, settings } = store.state;

    errorBanner.hidden = !errorMessage;
    const textEl = errorBanner.querySelector('[data-role="error-text"]');
    if (textEl) textEl.textContent = errorMessage ?? '';

    const hasTrace = !!trace;
    const firstLoad = status === 'loading' && !hasTrace;

    emptyState.hidden = status !== 'empty';
    loadingState.hidden = !firstLoad;
    sheetWrap.hidden = !hasTrace;
    recalcBadge.hidden = !(status === 'loading' && hasTrace);

    if (hasTrace && trace) {
      const svg = buildPosterSvg(trace, { ...settings, includeFrame: true }, source);
      if (mountedSvg) sheetWrap.replaceChild(svg, mountedSvg);
      else sheetWrap.appendChild(svg);
      mountedSvg = svg;
    }
  }

  return { el: viewport, update };
}

export function fileSizeLabel(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export const MAX_UPLOAD_LABEL = fileSizeLabel(MAX_UPLOAD_BYTES);
