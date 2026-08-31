import './style.css';
import { INK_PALETTE } from './lib/ink';
import { applyCombStamp, applySwirlStamp, FIELD_RES } from './lib/field';
import { renderBasinSync } from './lib/render';
import {
  canvasToBlob,
  composePosterCanvas,
  composeTilingPreview,
  downloadBlob,
  renderTileCanvas,
} from './lib/exportImage';
import type { CombDensity, InkId, PrintRecord, ToolId } from './lib/types';
import { StudioState } from './state';
import { showToast } from './ui/toast';
import { deckleEdgeFor } from './ui/shapes';

const BASIN_RES = 220;
const LONG_PRESS_DELAY = 420;
const AUTO_ADD_INTERVAL = 340;
const MAX_AUTO_ADDS = 9;
const COMB_STRENGTH = 0.1;
const SWIRL_STRENGTH = 0.045;
const STEP_LENGTH = 0.02;

const state = new StudioState();

const app = document.getElementById('app')!;
app.innerHTML = `
  <div class="app-shell">
    <header class="masthead">
      <p class="masthead__eyebrow"><span class="jp">工房 硯之間</span> <span class="en">— Digital Suminagashi Workshop</span></p>
      <h1 class="masthead__title">墨流し<span class="masthead__title-sub">Suminagashi Marbling Studio</span></h1>
    </header>

    <div class="studio">
      <aside class="tray" aria-label="道具立て">
        <section>
          <div class="tray__section-title"><span class="jp">インク</span><span>PIGMENTS</span></div>
          <div class="ink-grid" id="inkGrid" role="group" aria-label="インクを選ぶ"></div>
        </section>

        <section>
          <div class="tray__section-title"><span class="jp">道具</span><span>TOOL</span></div>
          <div class="tool-switch" id="toolSwitch" role="group" aria-label="道具を選ぶ">
            <button class="tool-btn" data-tool="drop" aria-pressed="true">
              <span class="tool-btn__glyph" aria-hidden="true">◌</span>
              <span class="tool-btn__label">滴</span>
            </button>
            <button class="tool-btn" data-tool="comb" aria-pressed="false">
              <span class="tool-btn__glyph" aria-hidden="true">〰</span>
              <span class="tool-btn__label">櫛</span>
            </button>
            <button class="tool-btn" data-tool="swirl" aria-pressed="false">
              <span class="tool-btn__glyph" aria-hidden="true">☯</span>
              <span class="tool-btn__label">渦</span>
            </button>
          </div>
          <div class="density-switch" id="densitySwitch" hidden role="group" aria-label="櫛の目の粗さ">
            <button class="density-btn density-btn--jp" data-density="coarse">粗</button>
            <button class="density-btn density-btn--jp" data-density="medium" aria-pressed="true">中</button>
            <button class="density-btn density-btn--jp" data-density="dense">密</button>
          </div>
        </section>

        <section>
          <div class="tray__section-title"><span class="jp">手順</span><span>ACTIONS</span></div>
          <div class="action-row">
            <button class="btn" id="undoBtn" disabled>元に戻す</button>
            <button class="btn btn--danger" id="resetBtn">水盤を清める</button>
          </div>
          <div class="readout" style="margin-top:10px;">
            <span>DROPS</span><strong id="dropCount">0</strong>
          </div>
          <div class="readout">
            <span>HISTORY</span><strong id="historyCount">0/16</strong>
          </div>
          <div class="readout">
            <span>FIELD</span><strong>${FIELD_RES}×${FIELD_RES}</strong>
          </div>
        </section>

        <section>
          <div class="tray__section-title"><span class="jp">仕上げ</span><span>PRINT</span></div>
          <button class="btn btn--dip" id="dipBtn" disabled>紙を浸して引き上げる</button>
        </section>
      </aside>

      <main class="basin-stage">
        <div class="basin-frame">
          <div class="basin-frame__vignette" aria-hidden="true"></div>
          <div class="basin-frame__spotlight" aria-hidden="true"></div>
          <div class="basin-frame__well">
            <canvas class="basin-canvas" id="basinCanvas" width="${BASIN_RES}" height="${BASIN_RES}"
              role="img" aria-label="墨流しの水盤。タップまたはドラッグして模様を作れます。"></canvas>
            <div class="sweep-layer" id="sweepLayer" aria-hidden="true">
              <div class="sweep-paper">
                <div class="sweep-paper__glow"></div>
                <div class="sweep-paper__print" id="sweepPrintImg"></div>
              </div>
            </div>
          </div>
        </div>
        <p class="basin-hint">
          水盤 — <strong>${BASIN_RES}×${BASIN_RES}</strong> · 周期境界（継ぎ目のない1タイル）
        </p>
      </main>

      <section class="gallery" aria-label="刷りギャラリー">
        <div class="gallery__header">
          <h2>刷り — Prints</h2>
          <span class="gallery__count" id="printCount">0 枚</span>
        </div>
        <div id="galleryBody"></div>
      </section>
    </div>

    <p class="footer-note">app-factory パイプラインによる自律生成プロトタイプ — セッション内のみで保持されます（リロードで消えます）</p>
  </div>

  <div class="modal-overlay" id="modalOverlay" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <button class="modal__close" id="modalClose" aria-label="閉じる">×</button>
      <h3 class="modal__title" id="modalTitle">書き出し</h3>
      <p class="modal__subtitle" id="modalSubtitle"></p>
      <div class="modal__preview" id="modalPreview"></div>
      <div class="modal__field" id="repeatField" hidden>
        <label>敷き詰めプレビュー</label>
        <div class="repeat-switch" id="repeatSwitch">
          <button class="density-btn" data-repeat="2" aria-pressed="true">2×2</button>
          <button class="density-btn" data-repeat="3" aria-pressed="false">3×3</button>
        </div>
      </div>
      <div class="modal__field">
        <label>書き出し解像度</label>
        <div class="res-switch" id="resSwitch">
          <button class="density-btn" data-res="512" aria-pressed="true">512px</button>
          <button class="density-btn" data-res="1024">1024px</button>
          <button class="density-btn" data-res="2048">2048px</button>
        </div>
      </div>
      <div class="modal__actions">
        <button class="btn" id="modalExportBtn">PNGを書き出す</button>
      </div>
    </div>
  </div>

  <div id="toast-root"></div>
`;

/* ---------------------------------------------------------------------- */
/* Element references                                                      */
/* ---------------------------------------------------------------------- */

const inkGrid = document.getElementById('inkGrid')!;
const toolSwitch = document.getElementById('toolSwitch')!;
const densitySwitch = document.getElementById('densitySwitch')!;
const undoBtn = document.getElementById('undoBtn') as HTMLButtonElement;
const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
const dipBtn = document.getElementById('dipBtn') as HTMLButtonElement;
const dropCountEl = document.getElementById('dropCount')!;
const historyCountEl = document.getElementById('historyCount')!;
const basinCanvas = document.getElementById('basinCanvas') as HTMLCanvasElement;
const basinCtx = basinCanvas.getContext('2d')!;
const sweepLayer = document.getElementById('sweepLayer')!;
const sweepPrintImg = document.getElementById('sweepPrintImg')!;
const galleryBody = document.getElementById('galleryBody')!;
const printCountEl = document.getElementById('printCount')!;

const modalOverlay = document.getElementById('modalOverlay')!;
const modalTitle = document.getElementById('modalTitle')!;
const modalSubtitle = document.getElementById('modalSubtitle')!;
const modalPreview = document.getElementById('modalPreview')!;
const modalClose = document.getElementById('modalClose')!;
const modalExportBtn = document.getElementById('modalExportBtn') as HTMLButtonElement;
const repeatField = document.getElementById('repeatField')!;
const repeatSwitch = document.getElementById('repeatSwitch')!;
const resSwitch = document.getElementById('resSwitch')!;

/* ---------------------------------------------------------------------- */
/* Ink palette                                                             */
/* ---------------------------------------------------------------------- */

for (const ink of INK_PALETTE) {
  const btn = document.createElement('button');
  btn.className = 'ink-swatch';
  btn.type = 'button';
  btn.dataset.ink = ink.id;
  btn.setAttribute('aria-pressed', ink.id === state.selectedInk ? 'true' : 'false');
  const bg = ink.isResist
    ? 'rgba(236,229,216,0.16)'
    : `rgb(${ink.color[0]}, ${ink.color[1]}, ${ink.color[2]})`;
  btn.innerHTML = `
    <span class="ink-swatch__blob" style="--blob-color:${bg}"></span>
    <span class="ink-swatch__label">${ink.name}</span>
    <span class="ink-swatch__label-en">${ink.label}</span>
  `;
  btn.addEventListener('click', () => {
    state.selectedInk = ink.id as InkId;
    setActiveTool('drop');
    refreshInkSelection();
  });
  inkGrid.appendChild(btn);
}

function refreshInkSelection(): void {
  inkGrid.querySelectorAll<HTMLButtonElement>('.ink-swatch').forEach((el) => {
    el.setAttribute('aria-pressed', el.dataset.ink === state.selectedInk ? 'true' : 'false');
  });
}

/* ---------------------------------------------------------------------- */
/* Tool switch                                                             */
/* ---------------------------------------------------------------------- */

function setActiveTool(tool: ToolId): void {
  state.activeTool = tool;
  toolSwitch.querySelectorAll<HTMLButtonElement>('.tool-btn').forEach((el) => {
    el.setAttribute('aria-pressed', el.dataset.tool === tool ? 'true' : 'false');
  });
  densitySwitch.toggleAttribute('hidden', tool !== 'comb');
}

toolSwitch.querySelectorAll<HTMLButtonElement>('.tool-btn').forEach((btn) => {
  btn.addEventListener('click', () => setActiveTool(btn.dataset.tool as ToolId));
});

densitySwitch.querySelectorAll<HTMLButtonElement>('.density-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.combDensity = btn.dataset.density as CombDensity;
    densitySwitch.querySelectorAll<HTMLButtonElement>('.density-btn').forEach((el) => {
      el.setAttribute('aria-pressed', el === btn ? 'true' : 'false');
    });
  });
});

/* ---------------------------------------------------------------------- */
/* Rendering loop                                                          */
/* ---------------------------------------------------------------------- */

let renderQueued = false;
let previewDelta: Float32Array | null = null;

function scheduleRender(): void {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    doRender();
  });
}

function doRender(): void {
  let fieldForRender = state.field;
  if (previewDelta) {
    const combined = { res: state.field.res, data: state.field.data.slice() };
    for (let i = 0; i < combined.data.length; i++) combined.data[i] += previewDelta[i];
    fieldForRender = combined;
  }
  const img = renderBasinSync(state.drops, fieldForRender, BASIN_RES);
  basinCtx.putImageData(img, 0, 0);
  updateReadouts();
}

function updateReadouts(): void {
  dropCountEl.textContent = String(state.dropCount);
  historyCountEl.textContent = `${state.historyCount}/16`;
  undoBtn.disabled = !state.canUndo;
  dipBtn.disabled = state.dropCount === 0 || sweepLayer.classList.contains('is-active');
}

/* ---------------------------------------------------------------------- */
/* Basin pointer interaction                                               */
/* ---------------------------------------------------------------------- */

function pointerToBasinCoords(ev: PointerEvent): [number, number] {
  const rect = basinCanvas.getBoundingClientRect();
  const u = (ev.clientX - rect.left) / rect.width;
  const v = (ev.clientY - rect.top) / rect.height;
  return [((u % 1) + 1) % 1, ((v % 1) + 1) % 1];
}

// --- drop tool state ---
let longPressTimer: number | null = null;
let autoAddTimer: number | null = null;
let autoAddCount = 0;
let dropActionCount = 0;
let lastAutoWasResist = false;

function clearDropTimers(): void {
  if (longPressTimer !== null) window.clearTimeout(longPressTimer);
  if (autoAddTimer !== null) window.clearInterval(autoAddTimer);
  longPressTimer = null;
  autoAddTimer = null;
}

function startDropInteraction(u: number, v: number): void {
  state.addDrop(u, v, state.selectedInk);
  dropActionCount = 1;
  autoAddCount = 0;
  lastAutoWasResist = false;
  scheduleRender();

  longPressTimer = window.setTimeout(() => {
    autoAddTimer = window.setInterval(() => {
      if (autoAddCount >= MAX_AUTO_ADDS) {
        clearDropTimers();
        return;
      }
      const jitter = () => (Math.random() - 0.5) * 0.012;
      const ink: InkId = lastAutoWasResist ? state.selectedInk : 'dousa';
      lastAutoWasResist = !lastAutoWasResist;
      state.addDrop(((u + jitter()) % 1 + 1) % 1, ((v + jitter()) % 1 + 1) % 1, ink);
      dropActionCount++;
      autoAddCount++;
      scheduleRender();
    }, AUTO_ADD_INTERVAL);
  }, LONG_PRESS_DELAY);
}

function endDropInteraction(): void {
  clearDropTimers();
  if (dropActionCount > 0) {
    state.commitDropAction(dropActionCount);
    dropActionCount = 0;
    updateReadouts();
  }
}

// --- comb/swirl stroke state ---
let strokeActive = false;
let strokeLast: [number, number] | null = null;

function beginStroke(u: number, v: number): void {
  strokeActive = true;
  strokeLast = [u, v];
  previewDelta = state.createStrokeDelta();
}

function extendStroke(u: number, v: number): void {
  if (!strokeActive || !previewDelta || !strokeLast) return;
  let [lx, ly] = strokeLast;
  let dx = u - lx;
  let dy = v - ly;
  // Keep segments local (avoid a spurious long streak if the pointer briefly
  // wraps across the seam mid-drag).
  if (dx > 0.5) dx -= 1;
  if (dx < -0.5) dx += 1;
  if (dy > 0.5) dy -= 1;
  if (dy < -0.5) dy += 1;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-5) return;
  const steps = Math.max(1, Math.ceil(dist / STEP_LENGTH));
  const dirX = dx / dist;
  const dirY = dy / dist;

  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const px = ((lx + dx * t) % 1 + 1) % 1;
    const py = ((ly + dy * t) % 1 + 1) % 1;
    if (state.activeTool === 'comb') {
      applyCombStamp(previewDelta, FIELD_RES, px, py, dirX, dirY, state.combDensity, COMB_STRENGTH);
    } else if (state.activeTool === 'swirl') {
      applySwirlStamp(previewDelta, FIELD_RES, px, py, dirX, dirY, SWIRL_STRENGTH);
    }
  }
  strokeLast = [u, v];
  scheduleRender();
}

function endStroke(): void {
  if (!strokeActive || !previewDelta) return;
  strokeActive = false;
  state.commitWarpAction(previewDelta);
  previewDelta = null;
  strokeLast = null;
  scheduleRender();
  updateReadouts();
}

basinCanvas.addEventListener('pointerdown', (ev) => {
  basinCanvas.setPointerCapture(ev.pointerId);
  const [u, v] = pointerToBasinCoords(ev);
  if (state.activeTool === 'drop') {
    startDropInteraction(u, v);
  } else {
    beginStroke(u, v);
  }
});

basinCanvas.addEventListener('pointermove', (ev) => {
  if (ev.buttons === 0) return;
  const [u, v] = pointerToBasinCoords(ev);
  if (state.activeTool !== 'drop' && strokeActive) {
    extendStroke(u, v);
  }
});

function handlePointerEnd(): void {
  if (state.activeTool === 'drop') {
    endDropInteraction();
  } else {
    endStroke();
  }
}

basinCanvas.addEventListener('pointerup', handlePointerEnd);
basinCanvas.addEventListener('pointercancel', handlePointerEnd);
basinCanvas.addEventListener('pointerleave', (ev) => {
  if (ev.buttons === 0) handlePointerEnd();
});

/* ---------------------------------------------------------------------- */
/* Undo / reset                                                            */
/* ---------------------------------------------------------------------- */

undoBtn.addEventListener('click', () => {
  if (state.undo()) {
    scheduleRender();
    showToast('ひと手を戻しました');
  }
});

resetBtn.addEventListener('click', () => {
  if (state.dropCount === 0) return;
  const ok = window.confirm('水盤を空にします。この操作は元に戻せません。よろしいですか？');
  if (!ok) return;
  state.reset();
  scheduleRender();
  showToast('水盤を清めました');
});

/* ---------------------------------------------------------------------- */
/* Dip & lift — the signature print gesture                                */
/* ---------------------------------------------------------------------- */

dipBtn.addEventListener('click', () => {
  if (state.dropCount === 0 || sweepLayer.classList.contains('is-active')) return;

  const snapshot = basinCanvas.toDataURL('image/png');
  sweepPrintImg.style.backgroundImage = `url(${snapshot})`;
  sweepLayer.classList.add('is-active');
  dipBtn.disabled = true;

  window.setTimeout(() => {
    const print = state.makePrint(snapshot);
    sweepLayer.classList.remove('is-active');
    renderGallery();
    updateReadouts();
    showToast('刷りをギャラリーに納めました');
    void print;
  }, 820);
});

/* ---------------------------------------------------------------------- */
/* Gallery                                                                 */
/* ---------------------------------------------------------------------- */

function renderGallery(): void {
  printCountEl.innerHTML = `<strong>${state.prints.length}</strong> 枚`;
  if (state.prints.length === 0) {
    galleryBody.innerHTML = `
      <div class="gallery__empty">
        <span class="jp">まだ何も刷られていません</span>
        水盤に模様を作り、「紙を浸して引き上げる」で最初の一枚を。
      </div>
    `;
    return;
  }

  const track = document.createElement('div');
  track.className = 'gallery__track';
  for (const print of state.prints) {
    track.appendChild(buildPrintCard(print));
  }
  galleryBody.innerHTML = '';
  galleryBody.appendChild(track);
}

function buildPrintCard(print: PrintRecord): HTMLElement {
  const { clipPath, tilt } = deckleEdgeFor(print.id);
  const card = document.createElement('article');
  card.className = 'print-card';
  card.style.setProperty('--deckle', clipPath);
  card.style.setProperty('--tilt', `${tilt.toFixed(2)}deg`);

  const date = new Date(print.createdAt);
  const stamp = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  card.innerHTML = `
    <div class="print-card__img" style="background-image:url(${print.thumbnail})"></div>
    <div class="print-card__caption">${stamp} — ${print.drops.length} drop${print.drops.length === 1 ? '' : 's'}</div>
    <div class="print-card__actions">
      <button data-mode="poster">ポスターで書き出す</button>
      <button data-mode="tile">タイルで書き出す</button>
    </div>
  `;
  card.querySelectorAll<HTMLButtonElement>('.print-card__actions button').forEach((btn) => {
    btn.addEventListener('click', () => openExportModal(print, btn.dataset.mode as 'poster' | 'tile'));
  });
  return card;
}

/* ---------------------------------------------------------------------- */
/* Export modal                                                            */
/* ---------------------------------------------------------------------- */

let modalPrint: PrintRecord | null = null;
let modalMode: 'poster' | 'tile' = 'poster';
let modalResolution = 512;
let modalRepeat: 2 | 3 = 2;

function openExportModal(print: PrintRecord, mode: 'poster' | 'tile'): void {
  modalPrint = print;
  modalMode = mode;
  modalResolution = 512;
  modalRepeat = 2;

  modalTitle.textContent = mode === 'poster' ? 'ポスターとして書き出す' : 'タイルとして書き出す';
  modalSubtitle.textContent =
    mode === 'poster'
      ? '余白と真鍮の縁取りを添えた、鑑賞用の一枚として保存します。'
      : '継ぎ目のない壁紙タイルとして保存します。書き出し前に敷き詰めを確認できます。';

  repeatField.hidden = mode !== 'tile';
  resSwitch.querySelectorAll<HTMLButtonElement>('.density-btn').forEach((btn) => {
    btn.setAttribute('aria-pressed', btn.dataset.res === '512' ? 'true' : 'false');
  });
  repeatSwitch.querySelectorAll<HTMLButtonElement>('.density-btn').forEach((btn) => {
    btn.setAttribute('aria-pressed', btn.dataset.repeat === '2' ? 'true' : 'false');
  });

  modalOverlay.hidden = false;
  modalExportBtn.disabled = false;
  modalExportBtn.textContent = 'PNGを書き出す';

  if (mode === 'tile') {
    void refreshTilePreview();
  } else {
    modalPreview.innerHTML = `<img src="${print.thumbnail}" alt="刷りのプレビュー" />`;
  }
}

function closeExportModal(): void {
  modalOverlay.hidden = true;
  modalPrint = null;
}

modalClose.addEventListener('click', closeExportModal);
modalOverlay.addEventListener('click', (ev) => {
  if (ev.target === modalOverlay) closeExportModal();
});
window.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !modalOverlay.hidden) closeExportModal();
});

resSwitch.querySelectorAll<HTMLButtonElement>('.density-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    modalResolution = Number(btn.dataset.res);
    resSwitch.querySelectorAll<HTMLButtonElement>('.density-btn').forEach((el) => {
      el.setAttribute('aria-pressed', el === btn ? 'true' : 'false');
    });
  });
});

repeatSwitch.querySelectorAll<HTMLButtonElement>('.density-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    modalRepeat = Number(btn.dataset.repeat) as 2 | 3;
    repeatSwitch.querySelectorAll<HTMLButtonElement>('.density-btn').forEach((el) => {
      el.setAttribute('aria-pressed', el === btn ? 'true' : 'false');
    });
    void refreshTilePreview();
  });
});

async function refreshTilePreview(): Promise<void> {
  if (!modalPrint || modalMode !== 'tile') return;
  const print = modalPrint;
  modalPreview.innerHTML = `
    <div class="modal__preview-loading">
      <div class="spinner"></div>
      <span>継ぎ目を確認中…</span>
    </div>
  `;
  const tile = await renderTileCanvas(print.drops, print.field, 260);
  if (modalPrint !== print || modalMode !== 'tile') return; // stale
  const tiled = composeTilingPreview(tile, modalRepeat);
  modalPreview.innerHTML = '';
  modalPreview.appendChild(tiled);
}

modalExportBtn.addEventListener('click', () => {
  void runExport();
});

async function runExport(): Promise<void> {
  if (!modalPrint) return;
  const print = modalPrint;
  const mode = modalMode;
  const resolution = modalResolution;

  modalExportBtn.disabled = true;
  modalExportBtn.textContent = '書き出し中…';
  const priorPreviewHTML = modalPreview.innerHTML;
  modalPreview.innerHTML = `
    <div class="modal__preview-loading">
      <div class="spinner"></div>
      <span id="exportProgress">0%</span>
    </div>
  `;
  const progressEl = document.getElementById('exportProgress');

  try {
    const tile = await renderTileCanvas(print.drops, print.field, resolution, (frac) => {
      if (progressEl) progressEl.textContent = `${Math.round(frac * 100)}%`;
    });
    if (modalPrint !== print) return; // modal switched prints mid-export

    let outCanvas = tile;
    let filename = `suminagashi-tile-${resolution}.png`;
    if (mode === 'poster') {
      outCanvas = composePosterCanvas(tile, { index: state.prints.indexOf(print) + 1, createdAt: print.createdAt });
      filename = `suminagashi-poster-${resolution}.png`;
    }

    const blob = await canvasToBlob(outCanvas);
    downloadBlob(blob, filename);
    showToast(`${mode === 'poster' ? 'ポスター' : 'タイル'}を書き出しました（${resolution}px）`);
    closeExportModal();
  } catch (err) {
    console.error(err);
    showToast('書き出しに失敗しました。もう一度お試しください。', 'error');
    modalPreview.innerHTML = priorPreviewHTML;
  } finally {
    modalExportBtn.disabled = false;
    modalExportBtn.textContent = 'PNGを書き出す';
  }
}

/* ---------------------------------------------------------------------- */
/* Boot                                                                     */
/* ---------------------------------------------------------------------- */

setActiveTool('drop');
renderGallery();
doRender();
