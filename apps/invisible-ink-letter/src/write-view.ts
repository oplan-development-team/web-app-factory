import { buildShareUrl, MAX_LENGTH, NEON_COLOR_LABELS, NEON_COLORS, type Letter, type NeonColorKey } from './codec';
import { mountFlashlightStage, type FlashlightStageHandle } from './flashlight-stage';

const COLOR_ORDER: NeonColorKey[] = ['violet', 'cyan', 'magenta', 'acid'];

export function mountWriteView(root: HTMLElement): void {
  root.innerHTML = '';

  const page = el('div', 'page page--write');

  const header = buildHeader();

  const panel = el('section', 'letter-panel');
  panel.setAttribute('aria-label', '手紙を書く');

  const railLabel = el('div', 'letter-panel__rail');
  railLabel.textContent = 'W R I T E';

  const body = el('div', 'letter-panel__body');

  const title = el('h1', 'letter-panel__title');
  title.textContent = '暗闇に、ひとことだけ。';
  const lede = el('p', 'letter-panel__lede');
  lede.textContent = '打った文字は見えないインクになる。読む人が懐中電灯でなぞるまで、誰にも見えない。';

  const form = el('form', 'letter-form');
  form.noValidate = true;

  // --- 本文 ---
  const fieldText = el('div', 'field');
  const textLabel = el('label', 'field__label');
  textLabel.setAttribute('for', 'letter-text');
  textLabel.textContent = '本文';
  const textarea = document.createElement('textarea');
  textarea.id = 'letter-text';
  textarea.className = 'letter-textarea';
  textarea.maxLength = MAX_LENGTH;
  textarea.rows = 5;
  textarea.placeholder = 'ここに、誰にも読まれたくない言葉を。';
  textarea.setAttribute('aria-describedby', 'letter-count');
  const counter = el('p', 'field__counter');
  counter.id = 'letter-count';
  fieldText.append(textLabel, textarea, counter);

  // --- 色 ---
  const fieldColor = el('div', 'field');
  const colorLabel = el('div', 'field__label');
  colorLabel.textContent = 'インクの色';
  const swatchRow = el('div', 'swatch-row');
  swatchRow.setAttribute('role', 'radiogroup');
  swatchRow.setAttribute('aria-label', 'インクの色');

  let selectedColor: NeonColorKey = 'violet';
  const swatchButtons = new Map<NeonColorKey, HTMLButtonElement>();

  for (const key of COLOR_ORDER) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'swatch';
    swatch.style.setProperty('--swatch-color', NEON_COLORS[key]);
    swatch.setAttribute('role', 'radio');
    swatch.setAttribute('aria-checked', String(key === selectedColor));
    swatch.setAttribute('aria-label', NEON_COLOR_LABELS[key]);
    swatch.addEventListener('click', () => {
      selectedColor = key;
      for (const [k, btn] of swatchButtons) {
        btn.classList.toggle('is-selected', k === key);
        btn.setAttribute('aria-checked', String(k === key));
      }
      refreshPreviewLetter();
    });
    swatchButtons.set(key, swatch);
    swatchRow.append(swatch);
  }
  swatchButtons.get(selectedColor)?.classList.add('is-selected');
  swatchButtons.get(selectedColor)?.setAttribute('aria-checked', 'true');
  fieldColor.append(colorLabel, swatchRow);

  // --- アクション ---
  // ボタンは必ず<form>の子孫として配置する。<form>の外に置くと(type="submit"
  // でも)ネイティブのクリックではsubmitイベントが発火しない。
  const actions = el('div', 'letter-actions');
  const testButton = document.createElement('button');
  testButton.type = 'button';
  testButton.className = 'btn btn--ghost';
  testButton.textContent = '懐中電灯でテスト';

  const sealButton = document.createElement('button');
  sealButton.type = 'submit';
  sealButton.className = 'btn btn--primary';
  sealButton.textContent = '封をする';
  sealButton.disabled = true;

  actions.append(testButton, sealButton);

  form.append(fieldText, fieldColor, actions);

  const validationMsg = el('p', 'field__validation');
  validationMsg.setAttribute('role', 'status');

  // --- 結果パネル ---
  const resultPanel = el('div', 'result-panel');
  resultPanel.hidden = true;

  body.append(title, lede, form, validationMsg, resultPanel);
  panel.append(railLabel, body);
  page.append(header, panel);
  root.append(page);

  function currentLetter(): Letter {
    return { text: textarea.value, color: selectedColor };
  }

  function updateCounter(): void {
    const remaining = MAX_LENGTH - textarea.value.length;
    counter.textContent = `残り ${remaining} 字`;
    counter.classList.toggle('is-low', remaining <= 20);
  }

  function updateSealAvailability(): void {
    const hasContent = textarea.value.trim().length > 0;
    sealButton.disabled = !hasContent;
    validationMsg.textContent = hasContent ? '' : '';
  }

  textarea.addEventListener('input', () => {
    updateCounter();
    updateSealAvailability();
    refreshPreviewLetter();
  });
  updateCounter();

  // --- 懐中電灯プレビュー(モーダル) ---
  let previewStage: FlashlightStageHandle | null = null;

  function refreshPreviewLetter(): void {
    previewStage?.setLetter(currentLetter());
  }

  function openPreview(): void {
    const overlay = el('div', 'preview-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '懐中電灯でテスト表示');

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'preview-close';
    closeBtn.setAttribute('aria-label', '編集に戻る');
    closeBtn.innerHTML = '<span aria-hidden="true">&times;</span><span class="preview-close__label">編集に戻る</span>';

    const stageHost = el('div', 'preview-stage-host');

    overlay.append(closeBtn, stageHost);
    document.body.append(overlay);
    document.body.classList.add('no-scroll');

    previewStage = mountFlashlightStage(stageHost, currentLetter());

    function close(): void {
      previewStage?.destroy();
      previewStage = null;
      overlay.remove();
      document.body.classList.remove('no-scroll');
      document.removeEventListener('keydown', onKeydown);
    }

    function onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') close();
    }

    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', onKeydown);
  }

  testButton.addEventListener('click', () => {
    if (textarea.value.trim().length === 0) {
      validationMsg.textContent = 'テストするには、まず本文を書いてください。';
      textarea.focus();
      return;
    }
    validationMsg.textContent = '';
    openPreview();
  });

  // --- 封をする ---
  let copyResetTimer: number | undefined;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (textarea.value.trim().length === 0) {
      validationMsg.textContent = '手紙が空のままでは、封をできません。';
      textarea.focus();
      return;
    }
    validationMsg.textContent = '';
    showResult(currentLetter());
  });

  function showResult(letter: Letter): void {
    const url = buildShareUrl(letter);

    resultPanel.innerHTML = '';
    resultPanel.hidden = false;

    const resultTitle = el('h2', 'result-panel__title');
    resultTitle.textContent = '封をしました。';
    const resultLede = el('p', 'result-panel__lede');
    resultLede.textContent = 'このリンクを渡した相手だけが、暗闇の中でなぞって読めます。';

    const linkRow = el('div', 'result-panel__link-row');
    const linkInput = document.createElement('input');
    linkInput.type = 'text';
    linkInput.className = 'result-panel__link';
    linkInput.readOnly = true;
    linkInput.value = url;
    linkInput.setAttribute('aria-label', '共有用リンク');
    linkInput.addEventListener('focus', () => linkInput.select());

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn--primary btn--small';
    copyBtn.textContent = 'リンクをコピー';

    copyBtn.addEventListener('click', async () => {
      const ok = await copyToClipboard(url, linkInput);
      window.clearTimeout(copyResetTimer);
      copyBtn.textContent = ok ? 'コピーしました ✓' : 'コピーできません';
      copyBtn.classList.toggle('is-success', ok);
      copyResetTimer = window.setTimeout(() => {
        copyBtn.textContent = 'リンクをコピー';
        copyBtn.classList.remove('is-success');
      }, 2000);
    });

    linkRow.append(linkInput, copyBtn);

    const rewriteLink = document.createElement('button');
    rewriteLink.type = 'button';
    rewriteLink.className = 'link-quiet';
    rewriteLink.textContent = '書き直す';
    rewriteLink.addEventListener('click', () => {
      resultPanel.hidden = true;
      resultPanel.innerHTML = '';
      textarea.focus();
    });

    resultPanel.append(resultTitle, resultLede, linkRow, rewriteLink);
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  updateSealAvailability();
}

async function copyToClipboard(text: string, fallbackInput: HTMLInputElement): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy fallback
  }
  try {
    fallbackInput.focus();
    fallbackInput.select();
    const ok = document.execCommand('copy');
    return ok;
  } catch {
    return false;
  }
}

function buildHeader(): HTMLElement {
  const header = el('header', 'brand');
  const mark = el('p', 'brand__mark');
  mark.textContent = 'ブラックライト便箋';
  const sub = el('p', 'brand__sub');
  sub.textContent = '暗室の書き物机から、見えない手紙を。';
  header.append(mark, sub);
  return header;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
