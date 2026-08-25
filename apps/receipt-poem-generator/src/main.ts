import './style.css';
import type { AppState, ReceiptItem } from './types';
import { FOOTER_PHRASES, SAMPLE_ITEMS, SAMPLE_STORE_NAME, TOTAL_LABELS } from './data';
import { renderReceiptPreview, replayPrintAnimation } from './receiptRender';
import { exportReceiptToPng } from './canvasExport';
import { formatCaptionDate, generateReceiptNo, makeId, toDateTimeLocalValue } from './util';

function pickRandom<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function pickDifferent<T>(list: T[], current: T): T {
  if (list.length <= 1) return list[0];
  let next = current;
  while (next === current) next = pickRandom(list);
  return next;
}

const state: AppState = {
  storeName: SAMPLE_STORE_NAME,
  dateTimeLocal: toDateTimeLocalValue(new Date()),
  items: SAMPLE_ITEMS.map((s) => ({ id: makeId(), ...s })),
  totalLabel: pickRandom(TOTAL_LABELS),
  footerPhrase: pickRandom(FOOTER_PHRASES),
  poemMode: false,
  receiptNo: generateReceiptNo(SAMPLE_STORE_NAME),
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app が見つかりませんでした。');

app.innerHTML = `
  <div class="page">
    <header class="masthead">
      <p class="masthead__kicker">FOUND POEM FROM A RECEIPT</p>
      <h1 class="masthead__title">レシート詩集ジェネレーター</h1>
      <p class="masthead__lead">
        品名・数量・金額を書き入れると、感熱紙レシートの姿を借りて、今日という日の詩が刷り上がる。
      </p>
    </header>

    <main class="layout">
      <section class="manuscript" aria-label="品目の編集">
        <div class="manuscript__field-row">
          <label class="manuscript__label" for="storeName">店名（見出し）</label>
          <input id="storeName" class="manuscript__input manuscript__input--title" type="text" maxlength="40" />
        </div>
        <div class="manuscript__field-row">
          <label class="manuscript__label" for="dateTime">日付・時刻</label>
          <input id="dateTime" class="manuscript__input" type="datetime-local" />
        </div>

        <div class="manuscript__divider" role="separator"></div>

        <div class="manuscript__items-head">
          <span>品目 — 詩の行</span>
          <span class="manuscript__items-head-note">上下ボタンで行の順を編集できます</span>
        </div>
        <ol id="itemRows" class="manuscript__rows"></ol>
        <button id="addItemBtn" type="button" class="btn btn--add">＋ 行を書き足す</button>

        <div class="manuscript__divider" role="separator"></div>

        <div class="manuscript__preset-row">
          <span class="manuscript__label">合計の言い回し</span>
          <div class="manuscript__preset-value" id="totalLabelValue"></div>
          <button id="shuffleTotalBtn" type="button" class="btn btn--shuffle" title="言い回しを引き直す">
            ⟲ 引き直す
          </button>
        </div>
        <div class="manuscript__preset-row">
          <span class="manuscript__label">結びの一言</span>
          <div class="manuscript__preset-value" id="footerPhraseValue"></div>
          <button id="shuffleFooterBtn" type="button" class="btn btn--shuffle" title="結びの一言を引き直す">
            ⟲ 引き直す
          </button>
        </div>
      </section>

      <section class="exhibit-wrap" aria-label="レシートのプレビュー">
        <div class="exhibit-toolbar">
          <button id="poemToggleBtn" type="button" class="btn btn--poem" aria-pressed="false">
            詩として読む
          </button>
          <button id="exportBtn" type="button" class="btn btn--export">画像として書き出す</button>
        </div>
        <p id="exportHint" class="exhibit-hint" role="status" aria-live="polite"></p>

        <figure class="exhibit">
          <div class="exhibit__frame">
            <div id="receipt" class="receipt"></div>
          </div>
          <figcaption class="exhibit__caption" id="exhibitCaption"></figcaption>
        </figure>
      </section>
    </main>

    <footer class="page-footer">
      <p>入力・生成・画像の書き出しはすべてこの端末内で完結します。外部にデータは送信されません。</p>
      <p class="page-footer__note">app-factory パイプラインによる自律生成プロトタイプです。</p>
    </footer>
  </div>
`;

const storeNameInput = document.querySelector<HTMLInputElement>('#storeName')!;
const dateTimeInput = document.querySelector<HTMLInputElement>('#dateTime')!;
const itemRowsEl = document.querySelector<HTMLOListElement>('#itemRows')!;
const addItemBtn = document.querySelector<HTMLButtonElement>('#addItemBtn')!;
const totalLabelValueEl = document.querySelector<HTMLDivElement>('#totalLabelValue')!;
const footerPhraseValueEl = document.querySelector<HTMLDivElement>('#footerPhraseValue')!;
const shuffleTotalBtn = document.querySelector<HTMLButtonElement>('#shuffleTotalBtn')!;
const shuffleFooterBtn = document.querySelector<HTMLButtonElement>('#shuffleFooterBtn')!;
const poemToggleBtn = document.querySelector<HTMLButtonElement>('#poemToggleBtn')!;
const exportBtn = document.querySelector<HTMLButtonElement>('#exportBtn')!;
const exportHintEl = document.querySelector<HTMLParagraphElement>('#exportHint')!;
const receiptEl = document.querySelector<HTMLDivElement>('#receipt')!;
const exhibitCaptionEl = document.querySelector<HTMLElement>('#exhibitCaption')!;

storeNameInput.value = state.storeName;
dateTimeInput.value = state.dateTimeLocal;

let debounceTimer: number | undefined;
function scheduleUpdate(): void {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => updatePreview(false), 160);
}

function updateCaption(): void {
  const kind = state.poemMode ? '本日の詩' : '本日のレシート';
  exhibitCaptionEl.textContent = `Fig. 01 — ${kind}、${formatCaptionDate(state.dateTimeLocal)}`;
}

function updateExportGuard(): void {
  const empty = state.items.length === 0;
  exportBtn.toggleAttribute('disabled', empty);
  exportBtn.setAttribute('aria-disabled', String(empty));
  if (empty) {
    exportHintEl.textContent = '品目を1つ以上、左の原稿用紙に書き足すと画像として書き出せます。';
    exportHintEl.classList.add('exhibit-hint--guide');
  } else if (!exportHintEl.classList.contains('exhibit-hint--success')) {
    exportHintEl.textContent = '';
    exportHintEl.classList.remove('exhibit-hint--guide');
  }
}

function updatePreview(animate: boolean): void {
  renderReceiptPreview(receiptEl, state);
  if (animate) replayPrintAnimation(receiptEl);
  updateCaption();
  updateExportGuard();
}

function updatePresetDisplays(): void {
  totalLabelValueEl.textContent = state.totalLabel;
  footerPhraseValueEl.textContent = state.footerPhrase;
}

function buildItemRow(item: ReceiptItem, index: number, total: number): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'manuscript-row';
  li.dataset.id = item.id;

  li.innerHTML = `
    <div class="manuscript-row__index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</div>
    <div class="manuscript-row__fields">
      <input
        class="manuscript-row__name"
        type="text"
        data-field="name"
        placeholder="品名（詩の一行）"
        maxlength="60"
        aria-label="品名 ${index + 1}行目"
        value="${escapeAttr(item.name)}"
      />
      <div class="manuscript-row__numbers">
        <input
          class="manuscript-row__qty"
          type="number"
          data-field="qty"
          min="0"
          max="9999"
          step="1"
          inputmode="numeric"
          aria-label="数量 ${index + 1}行目"
          value="${item.qty}"
        />
        <span class="manuscript-row__x" aria-hidden="true">×</span>
        <span class="manuscript-row__yen" aria-hidden="true">¥</span>
        <input
          class="manuscript-row__price"
          type="number"
          data-field="unitPrice"
          min="0"
          step="1"
          inputmode="numeric"
          aria-label="単価 ${index + 1}行目"
          value="${item.unitPrice}"
        />
      </div>
    </div>
    <div class="manuscript-row__actions">
      <button type="button" class="manuscript-row__btn" data-action="up" ${index === 0 ? 'disabled' : ''} aria-label="この行を上へ移動">↑</button>
      <button type="button" class="manuscript-row__btn" data-action="down" ${index === total - 1 ? 'disabled' : ''} aria-label="この行を下へ移動">↓</button>
      <button type="button" class="manuscript-row__btn manuscript-row__btn--del" data-action="delete" aria-label="この行を削除">×</button>
    </div>
  `;
  return li;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderItemRows(): void {
  itemRowsEl.innerHTML = '';
  const total = state.items.length;
  state.items.forEach((item, index) => {
    itemRowsEl.appendChild(buildItemRow(item, index, total));
  });
}

function focusRowField(id: string, selector: string): void {
  const row = itemRowsEl.querySelector<HTMLElement>(`[data-id="${id}"]`);
  const field = row?.querySelector<HTMLElement>(selector);
  field?.focus();
}

// --- header fields ---
storeNameInput.addEventListener('input', () => {
  state.storeName = storeNameInput.value;
  scheduleUpdate();
});

dateTimeInput.addEventListener('input', () => {
  state.dateTimeLocal = dateTimeInput.value || state.dateTimeLocal;
  scheduleUpdate();
});

// --- item rows (event delegation; text/number edits update state in place to avoid focus loss) ---
itemRowsEl.addEventListener('input', (event) => {
  const target = event.target as HTMLInputElement;
  const row = target.closest<HTMLLIElement>('.manuscript-row');
  const field = target.dataset.field;
  if (!row || !field) return;
  const item = state.items.find((i) => i.id === row.dataset.id);
  if (!item) return;

  if (field === 'name') {
    item.name = target.value;
  } else if (field === 'qty') {
    item.qty = Math.max(0, Math.min(9999, Math.round(Number(target.value)) || 0));
  } else if (field === 'unitPrice') {
    item.unitPrice = Math.max(0, Math.round(Number(target.value)) || 0);
  }
  scheduleUpdate();
});

itemRowsEl.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.manuscript-row__btn');
  if (!button || button.disabled) return;
  const row = button.closest<HTMLLIElement>('.manuscript-row');
  const id = row?.dataset.id;
  if (!id) return;
  const index = state.items.findIndex((i) => i.id === id);
  if (index === -1) return;

  const action = button.dataset.action;
  if (action === 'up' && index > 0) {
    [state.items[index - 1], state.items[index]] = [state.items[index], state.items[index - 1]];
    renderItemRows();
    focusRowField(id, '[data-action="up"]');
    updatePreview(true);
  } else if (action === 'down' && index < state.items.length - 1) {
    [state.items[index + 1], state.items[index]] = [state.items[index], state.items[index + 1]];
    renderItemRows();
    focusRowField(id, '[data-action="down"]');
    updatePreview(true);
  } else if (action === 'delete') {
    state.items.splice(index, 1);
    renderItemRows();
    addItemBtn.focus();
    updatePreview(true);
  }
});

addItemBtn.addEventListener('click', () => {
  const newItem: ReceiptItem = { id: makeId(), name: '', qty: 1, unitPrice: 0 };
  state.items.push(newItem);
  renderItemRows();
  focusRowField(newItem.id, '.manuscript-row__name');
  updatePreview(true);
});

// --- presets ---
shuffleTotalBtn.addEventListener('click', () => {
  state.totalLabel = pickDifferent(TOTAL_LABELS, state.totalLabel);
  updatePresetDisplays();
  updatePreview(true);
});

shuffleFooterBtn.addEventListener('click', () => {
  state.footerPhrase = pickDifferent(FOOTER_PHRASES, state.footerPhrase);
  updatePresetDisplays();
  updatePreview(true);
});

// --- poem mode ---
poemToggleBtn.addEventListener('click', () => {
  state.poemMode = !state.poemMode;
  poemToggleBtn.setAttribute('aria-pressed', String(state.poemMode));
  poemToggleBtn.textContent = state.poemMode ? '通常表示に戻る' : '詩として読む';
  poemToggleBtn.classList.toggle('is-active', state.poemMode);
  updatePreview(true);
});

// --- export ---
let successTimer: number | undefined;
exportBtn.addEventListener('click', async () => {
  if (state.items.length === 0) {
    updateExportGuard();
    return;
  }
  window.clearTimeout(successTimer);
  exportBtn.disabled = true;
  exportBtn.classList.add('is-busy');
  const originalLabel = exportBtn.textContent;
  exportBtn.textContent = '刷っています…';
  exportHintEl.classList.remove('exhibit-hint--guide');
  exportHintEl.classList.remove('exhibit-hint--success');

  try {
    await exportReceiptToPng(state);
    exportHintEl.textContent = '書き出しました。ダウンロード先をご確認ください。';
    exportHintEl.classList.add('exhibit-hint--success');
    successTimer = window.setTimeout(() => {
      exportHintEl.classList.remove('exhibit-hint--success');
      updateExportGuard();
    }, 3200);
  } catch (err) {
    console.error(err);
    exportHintEl.textContent = '書き出しに失敗しました。お手数ですが、もう一度お試しください。';
    exportHintEl.classList.add('exhibit-hint--guide');
  } finally {
    exportBtn.disabled = state.items.length === 0;
    exportBtn.classList.remove('is-busy');
    exportBtn.textContent = originalLabel;
  }
});

// --- initial mount ---
renderItemRows();
updatePresetDisplays();
updatePreview(true);
