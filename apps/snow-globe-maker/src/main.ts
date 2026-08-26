import './style.css';
import { Dome } from './globe/dome';
import type { ParticleStyle } from './globe/particles';
import type { PedestalMaterial } from './globe/pedestal';
import { PhotoEditor } from './scene/photoEditor';
import { DrawEditor, type DrawTool } from './scene/drawEditor';
import { bindDomeInteraction } from './interaction/domeInteraction';
import { bindDeviceMotionShake } from './interaction/deviceMotion';
import { composePostcard, downloadCanvasAsPng } from './postcard';

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`#${id} が見つかりません`);
  return found as T;
}

function debounce<Args extends unknown[]>(fn: (...args: Args) => void, wait: number): (...args: Args) => void {
  let handle = 0;
  return (...args: Args) => {
    window.clearTimeout(handle);
    handle = window.setTimeout(() => fn(...args), wait);
  };
}

// --- element lookups -------------------------------------------------
const domeCanvas = el<HTMLCanvasElement>('dome-canvas');
const domeRig = el<HTMLElement>('dome-rig');
const domeTapHint = el<HTMLElement>('dome-tap-hint');
const pedestalEl = el<HTMLElement>('pedestal');

const tabPhoto = el<HTMLButtonElement>('tab-photo');
const tabDraw = el<HTMLButtonElement>('tab-draw');
const panelPhoto = el<HTMLElement>('panel-photo');
const panelDraw = el<HTMLElement>('panel-draw');

const dropzone = el<HTMLLabelElement>('dropzone');
const fileInput = el<HTMLInputElement>('file-input');
const photoError = el<HTMLElement>('photo-error');
const photoEditorSection = el<HTMLElement>('photo-editor');
const photoCropCanvas = el<HTMLCanvasElement>('photo-crop-canvas');
const photoZoom = el<HTMLInputElement>('photo-zoom');
const photoChangeBtn = el<HTMLButtonElement>('photo-change-btn');

const drawCanvas = el<HTMLCanvasElement>('draw-canvas');
const drawClearBtn = el<HTMLButtonElement>('draw-clear-btn');

const motionPermissionBtn = el<HTMLButtonElement>('motion-permission-btn');
const motionStatus = el<HTMLElement>('motion-status');

const exportBtn = el<HTMLButtonElement>('export-btn');
const postcardModal = el<HTMLElement>('postcard-modal');
const postcardBackdrop = el<HTMLElement>('postcard-modal-backdrop');
const postcardCloseBtn = el<HTMLButtonElement>('postcard-close-btn');
const postcardDownloadBtn = el<HTMLButtonElement>('postcard-download-btn');
const postcardMessage = el<HTMLInputElement>('postcard-message');
const postcardCanvas = el<HTMLCanvasElement>('postcard-canvas');

// --- core pieces -------------------------------------------------------
const dome = new Dome(domeCanvas, 'snow');
dome.start();

const photoEditor = new PhotoEditor(photoCropCanvas);
const drawEditor = new DrawEditor(drawCanvas);

let currentTab: 'photo' | 'draw' = 'photo';
let currentMaterial: PedestalMaterial = 'gold';

function activateTab(mode: 'photo' | 'draw'): void {
  currentTab = mode;
  const isPhoto = mode === 'photo';
  tabPhoto.setAttribute('aria-selected', String(isPhoto));
  tabDraw.setAttribute('aria-selected', String(!isPhoto));
  tabPhoto.classList.toggle('is-active', isPhoto);
  tabDraw.classList.toggle('is-active', !isPhoto);
  panelPhoto.hidden = !isPhoto;
  panelDraw.hidden = isPhoto;
  dome.setScene(isPhoto ? (photoEditor.hasImage() ? photoEditor.canvas : null) : drawEditor.canvas);
}

tabPhoto.addEventListener('click', () => activateTab('photo'));
tabDraw.addEventListener('click', () => activateTab('draw'));
activateTab('photo');

// --- photo tab -----------------------------------------------------------
async function handleNewPhotoFile(file: File): Promise<void> {
  const err = photoEditor.validateFile(file);
  if (err) {
    photoError.hidden = false;
    photoError.textContent = err;
    return;
  }
  try {
    await photoEditor.loadFile(file);
  } catch {
    photoError.hidden = false;
    photoError.textContent = '画像を読み込めませんでした。別のファイルをお試しください。';
    return;
  }
  photoError.hidden = true;
  photoZoom.value = '1';
  photoEditorSection.hidden = false;
  dropzone.hidden = true;
  if (currentTab === 'photo') dome.setScene(photoEditor.canvas);
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void handleNewPhotoFile(file);
});

dropzone.addEventListener('dragover', (ev) => {
  ev.preventDefault();
  dropzone.classList.add('is-dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
dropzone.addEventListener('drop', (ev) => {
  ev.preventDefault();
  dropzone.classList.remove('is-dragover');
  const file = ev.dataTransfer?.files?.[0];
  if (file) void handleNewPhotoFile(file);
});

photoZoom.addEventListener('input', () => {
  photoEditor.setZoom(parseFloat(photoZoom.value));
});

photoChangeBtn.addEventListener('click', () => {
  fileInput.value = '';
  photoEditorSection.hidden = true;
  dropzone.hidden = false;
});

// --- draw tab -----------------------------------------------------------
function setActiveSwatch(target: HTMLElement): void {
  document.querySelectorAll('.swatch-btn').forEach((btn) => btn.classList.remove('is-active'));
  target.classList.add('is-active');
}
function setActiveTool(tool: DrawTool): void {
  document.querySelectorAll<HTMLButtonElement>('.tool-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.tool === tool);
  });
  document.querySelectorAll('.stamp-btn').forEach((btn) => btn.classList.remove('is-active'));
}

document.querySelectorAll<HTMLButtonElement>('.swatch-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const color = btn.dataset.color;
    if (!color) return;
    drawEditor.setColor(color);
    drawEditor.setTool('brush');
    setActiveSwatch(btn);
    setActiveTool('brush');
  });
});

document.querySelectorAll<HTMLButtonElement>('.tool-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool as DrawTool | undefined;
    if (!tool) return;
    drawEditor.setTool(tool);
    setActiveTool(tool);
  });
});

document.querySelectorAll<HTMLButtonElement>('.stamp-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const stamp = btn.dataset.stamp;
    if (!stamp) return;
    drawEditor.setStamp(stamp);
    document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('is-active'));
    document.querySelectorAll('.stamp-btn').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
  });
});

drawClearBtn.addEventListener('click', () => drawEditor.clear());

// --- pedestal material -----------------------------------------------------
document.querySelectorAll<HTMLButtonElement>('.material-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const material = btn.dataset.material as PedestalMaterial | undefined;
    if (!material) return;
    currentMaterial = material;
    pedestalEl.dataset.material = material;
    document.querySelectorAll('.material-btn').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
  });
});

// --- particle style ----------------------------------------------------------
document.querySelectorAll<HTMLButtonElement>('.particle-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const style = btn.dataset.particle as ParticleStyle | undefined;
    if (!style) return;
    dome.setParticleStyle(style);
    document.querySelectorAll('.particle-btn').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
  });
});

// --- shake interactions ----------------------------------------------------
bindDomeInteraction(domeRig, dome, domeTapHint);
bindDeviceMotionShake(domeRig, dome, motionPermissionBtn, motionStatus);

// --- postcard export ---------------------------------------------------------
let frozenSnapshot: HTMLCanvasElement | null = null;

async function renderPostcardPreview(): Promise<void> {
  if (!frozenSnapshot) return;
  await composePostcard({
    domeSource: frozenSnapshot,
    material: currentMaterial,
    message: postcardMessage.value,
    target: postcardCanvas,
  });
}

function openPostcardModal(): void {
  postcardModal.hidden = false;
  document.addEventListener('keydown', onModalKeydown);
}
function closePostcardModal(): void {
  postcardModal.hidden = true;
  document.removeEventListener('keydown', onModalKeydown);
}
function onModalKeydown(ev: KeyboardEvent): void {
  if (ev.key === 'Escape') closePostcardModal();
}

exportBtn.addEventListener('click', async () => {
  const snap = document.createElement('canvas');
  snap.width = domeCanvas.width;
  snap.height = domeCanvas.height;
  const sctx = snap.getContext('2d');
  if (sctx) sctx.drawImage(domeCanvas, 0, 0);
  frozenSnapshot = snap;
  openPostcardModal();
  await renderPostcardPreview();
});

postcardMessage.addEventListener('input', debounce(() => void renderPostcardPreview(), 150));
postcardCloseBtn.addEventListener('click', closePostcardModal);
postcardBackdrop.addEventListener('click', closePostcardModal);
postcardDownloadBtn.addEventListener('click', () => {
  downloadCanvasAsPng(postcardCanvas, `snow-globe-postcard-${Date.now()}.png`);
});
