import './style.css';
import { analyzeImage } from './lib/imageAnalysis';
import { generateCaption } from './lib/generator';
import { renderPlate } from './lib/render';
import { canvasToDownload, renderExportCanvas } from './lib/exportImage';
import { loadImageFromFile, validateImageFile } from './lib/fileHandling';
import { sanitizeFilename } from './lib/filename';
import type { GeneratedCaption, ImageAnalysis } from './lib/types';

const uploadSection = document.querySelector<HTMLElement>('#upload-section')!;
const exhibitSection = document.querySelector<HTMLElement>('#exhibit-section')!;
const dropzone = document.querySelector<HTMLLabelElement>('#dropzone')!;
const fileInput = document.querySelector<HTMLInputElement>('#file-input')!;
const uploadError = document.querySelector<HTMLElement>('#upload-error')!;
const exhibitImage = document.querySelector<HTMLImageElement>('#exhibit-image')!;
const plate = document.querySelector<HTMLElement>('#plate')!;
const regenerateBtn = document.querySelector<HTMLButtonElement>('#regenerate-btn')!;
const copyBtn = document.querySelector<HTMLButtonElement>('#copy-btn')!;
const downloadBtn = document.querySelector<HTMLButtonElement>('#download-btn')!;
const resetBtn = document.querySelector<HTMLButtonElement>('#reset-btn')!;
const statusMessage = document.querySelector<HTMLElement>('#status-message')!;

let currentAnalysis: ImageAnalysis | null = null;
let currentCaption: GeneratedCaption | null = null;
let currentObjectUrl: string | null = null;

function showStatus(message: string): void {
  statusMessage.textContent = message;
  window.clearTimeout(showStatus.timer);
  showStatus.timer = window.setTimeout(() => {
    statusMessage.textContent = '';
  }, 3200);
}
showStatus.timer = 0;

function showUploadError(message: string): void {
  uploadError.textContent = message;
  uploadError.hidden = false;
}

function clearUploadError(): void {
  uploadError.hidden = true;
  uploadError.textContent = '';
}

function regenerateAndRender(): void {
  if (!currentAnalysis) return;
  currentCaption = generateCaption(currentAnalysis);
  plate.classList.remove('plate-enter');
  renderPlate(plate, currentCaption);
  // 強制リフローで再アニメーションを発火させる
  void plate.offsetWidth;
  plate.classList.add('plate-enter');
}

async function handleFile(file: File): Promise<void> {
  clearUploadError();
  const validationError = validateImageFile(file);
  if (validationError) {
    showUploadError(validationError);
    return;
  }

  try {
    const { image, objectUrl } = await loadImageFromFile(file);

    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
    }
    currentObjectUrl = objectUrl;

    exhibitImage.src = objectUrl;
    currentAnalysis = analyzeImage(image);
    regenerateAndRender();

    uploadSection.hidden = true;
    exhibitSection.hidden = false;
    exhibitSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    showUploadError(err instanceof Error ? err.message : '画像の読み込みに失敗しました。');
  }
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void handleFile(file);
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('is-dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('is-dragover');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('is-dragover');
  const file = e.dataTransfer?.files?.[0];
  if (file) void handleFile(file);
});

regenerateBtn.addEventListener('click', () => {
  regenerateAndRender();
});

copyBtn.addEventListener('click', () => {
  if (!currentCaption) return;
  const text = [
    currentCaption.title,
    currentCaption.artist,
    `${currentCaption.year}／${currentCaption.medium}`,
    currentCaption.dimensions,
    '',
    currentCaption.body,
  ].join('\n');

  navigator.clipboard
    .writeText(text)
    .then(() => showStatus('キャプション本文をコピーしました。'))
    .catch(() => showStatus('コピーに失敗しました。手動で選択してください。'));
});

downloadBtn.addEventListener('click', () => {
  if (!currentCaption) return;
  const label = downloadBtn.querySelector('span')!;
  const previousLabel = label.textContent;
  downloadBtn.disabled = true;
  label.textContent = '書き出し中…';

  renderExportCanvas(exhibitImage, currentCaption)
    .then((canvas) => {
      canvasToDownload(canvas, `${sanitizeFilename(currentCaption!.title)}.png`);
      showStatus('展示画像を保存しました。');
    })
    .catch(() => {
      showStatus('画像の書き出しに失敗しました。');
    })
    .finally(() => {
      downloadBtn.disabled = false;
      label.textContent = previousLabel;
    });
});

resetBtn.addEventListener('click', () => {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  currentAnalysis = null;
  currentCaption = null;
  exhibitImage.src = '';
  plate.replaceChildren();
  fileInput.value = '';
  exhibitSection.hidden = true;
  uploadSection.hidden = false;
  clearUploadError();
});
