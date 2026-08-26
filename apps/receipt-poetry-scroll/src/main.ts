import './style.css';
import { deriveReceipt } from './receiptData';
import { renderReceiptDom } from './receiptView';
import { buildExportCanvas, canvasToPngBlob } from './canvasExport';
import { generateStoreName } from './storeName';
import { SAMPLE_TEXT } from './sampleText';

interface AppState {
  rawText: string;
  storeName: string;
  seed: number;
}

const INITIAL_SEED = 0x1234abcd;

const state: AppState = {
  rawText: '',
  storeName: generateStoreName(),
  seed: INITIAL_SEED,
};

const linesInput = document.getElementById('lines-input') as HTMLTextAreaElement;
const storeNameInput = document.getElementById('store-name-input') as HTMLInputElement;
const regenStoreNameBtn = document.getElementById('regen-store-name') as HTMLButtonElement;
const rerollBtn = document.getElementById('reroll-prices') as HTMLButtonElement;
const downloadBtn = document.getElementById('download-png') as HTMLButtonElement;
const insertSampleBtn = document.getElementById('insert-sample') as HTMLButtonElement;
const statusEl = document.getElementById('status-msg') as HTMLParagraphElement;

const emptyStateEl = document.getElementById('receipt-empty') as HTMLDivElement;
const receiptEl = document.getElementById('receipt') as HTMLDivElement;
const receiptBodyEl = document.getElementById('receipt-body') as HTMLDivElement;

storeNameInput.value = state.storeName;

let statusTimer: number | undefined;

function setStatus(message: string, tone: 'info' | 'success' | 'error' = 'info'): void {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
  if (statusTimer) window.clearTimeout(statusTimer);
  if (tone !== 'info' && message) {
    statusTimer = window.setTimeout(() => {
      statusEl.textContent = '';
      statusEl.removeAttribute('data-tone');
    }, 4000);
  }
}

/** ロールから紙が繰り出されるような演出を、意味のある更新のたびに再生する。 */
function playFeedMotion(el: HTMLElement): void {
  el.classList.remove('is-feeding');
  // 強制リフローでアニメーションを確実に再トリガーする
  void el.offsetWidth;
  el.classList.add('is-feeding');
}

function currentReceipt() {
  return deriveReceipt(state.rawText, state.storeName, state.seed);
}

function render(withMotion: boolean): void {
  const data = currentReceipt();

  if (!data) {
    receiptEl.hidden = true;
    emptyStateEl.hidden = false;
    downloadBtn.disabled = true;
    return;
  }

  renderReceiptDom(receiptBodyEl, data);
  emptyStateEl.hidden = true;
  receiptEl.hidden = false;
  downloadBtn.disabled = false;

  if (withMotion) {
    playFeedMotion(receiptEl);
  }
}

// --- テキストエリア：貼り付け・入力 ---
let inputDebounce: number | undefined;
linesInput.addEventListener('input', () => {
  const hadContentBefore = state.rawText.trim().length > 0;
  window.clearTimeout(inputDebounce);
  inputDebounce = window.setTimeout(() => {
    state.rawText = linesInput.value;
    const hasContentNow = state.rawText.trim().length > 0;
    render(!hadContentBefore || hasContentNow);
  }, 120);
});

// --- 店名：手入力での編集 ---
storeNameInput.addEventListener('input', () => {
  state.storeName = storeNameInput.value;
  render(false);
});

// --- 店名：自動生成ボタン ---
regenStoreNameBtn.addEventListener('click', () => {
  state.storeName = generateStoreName();
  storeNameInput.value = state.storeName;
  render(true);
  setStatus(`店名を「${state.storeName}」に変えました。`, 'success');
});

// --- 値段の引き直し ---
rerollBtn.addEventListener('click', () => {
  state.seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  if (!state.rawText.trim()) {
    setStatus('先にリストを貼り付けてください。', 'error');
    return;
  }
  render(true);
  setStatus('値段を引き直しました。', 'success');
});

// --- サンプル挿入 ---
insertSampleBtn.addEventListener('click', () => {
  linesInput.value = SAMPLE_TEXT;
  state.rawText = SAMPLE_TEXT;
  render(true);
  linesInput.focus();
  setStatus('サンプルのリストを挿入しました。', 'success');
});

// --- PNG書き出し ---
downloadBtn.addEventListener('click', () => {
  void handleDownload();
});

async function handleDownload(): Promise<void> {
  const data = currentReceipt();
  if (!data) {
    setStatus('先にリストを貼り付けてください。', 'error');
    return;
  }

  downloadBtn.disabled = true;
  const originalLabel = downloadBtn.textContent ?? 'PNGで刷り上げる';
  downloadBtn.textContent = '刷っています…';

  try {
    const canvas = await buildExportCanvas(data);
    const blob = await canvasToPngBlob(canvas);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = data.storeName.replace(/[^\p{L}\p{N}]+/gu, '') || 'receipt';
    a.href = url;
    a.download = `receipt-poetry-${safeName}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    setStatus('PNGを保存しました。', 'success');
  } catch (err) {
    console.error(err);
    setStatus('書き出しに失敗しました。もう一度お試しください。', 'error');
  } finally {
    downloadBtn.disabled = state.rawText.trim().length === 0;
    downloadBtn.textContent = originalLabel;
  }
}

render(false);
