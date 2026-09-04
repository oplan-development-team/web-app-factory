import { el } from './dom';
import { Store, hasContent, MIN_INKS, MAX_INKS } from '../state';
import {
  AppState,
  AspectId,
  ExportScale,
  INK_MAP,
  INK_PRESETS,
  InkId,
  LayoutPreset,
  ShapeKind,
} from '../types';
import { buildPlates } from '../core/plates';
import { exportPosterPNG, downloadBlob } from '../core/exportPoster';

interface Block {
  root: HTMLElement;
  update: (state: AppState) => void;
}

function panel(title: string, extraClass = ''): { root: HTMLElement; body: HTMLElement } {
  const root = el('section', { class: `panel ${extraClass}`.trim() });
  root.append(el('h3', { class: 'panel-title' }, [title]));
  const body = el('div', { class: 'panel-body' });
  root.append(body);
  return { root, body };
}

interface RadioOption {
  value: string;
  label: string;
}

function buildButtonRadioGroup(
  name: string,
  options: RadioOption[],
  onChange: (value: string) => void,
): { root: HTMLElement; update: (current: string) => void } {
  const root = el('div', { class: 'button-group', role: 'radiogroup' });
  const inputs: HTMLInputElement[] = [];
  for (const opt of options) {
    const id = `${name}-${opt.value}`;
    const input = el('input', {
      type: 'radio',
      name,
      id,
      value: opt.value,
      class: 'visually-hidden button-group__input',
    }) as HTMLInputElement;
    const label = el('label', { for: id, class: 'button-group__option' }, [opt.label]);
    input.addEventListener('change', () => {
      if (input.checked) onChange(opt.value);
    });
    root.append(input, label);
    inputs.push(input);
  }
  function update(current: string) {
    for (const input of inputs) input.checked = input.value === current;
  }
  return { root, update };
}

// ---------------------------------------------------------------------------
// 1. Photo block
// ---------------------------------------------------------------------------
function buildPhotoBlock(store: Store): Block {
  const { root, body } = panel('PHOTO / 写真（任意）');
  const dropzone = el(
    'div',
    {
      class: 'dropzone',
      tabindex: '0',
      role: 'button',
      'aria-label': '写真をアップロード。クリックまたはドラッグ＆ドロップ。JPEGまたはPNG。',
    },
    [
      el('p', { class: 'dropzone__text' }, ['画像をドロップ、またはクリックして選択']),
      el('p', { class: 'dropzone__hint' }, ['JPEG / PNG']),
    ],
  );
  const fileInput = el('input', {
    type: 'file',
    accept: 'image/jpeg,image/png',
    class: 'visually-hidden',
  }) as HTMLInputElement;
  const errorText = el('p', { class: 'field-error', role: 'alert' }, []) as HTMLParagraphElement;
  const previewRow = el('div', { class: 'photo-preview' });
  body.append(dropzone, fileInput, errorText, previewRow);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    errorText.textContent = '';
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      errorText.textContent = 'JPEGまたはPNG画像を選択してください';
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      store.dispatch({ type: 'SET_PHOTO', bitmap, fileName: file.name });
    } catch {
      errorText.textContent = '画像を読み込めませんでした。別のファイルをお試しください';
    }
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('is-dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
    void handleFiles(e.dataTransfer?.files ?? null);
  });
  fileInput.addEventListener('change', () => {
    void handleFiles(fileInput.files);
    fileInput.value = '';
  });

  function update(state: AppState) {
    if (state.photo.fileName) {
      const removeBtn = el('button', { type: 'button', class: 'btn btn-small' }, ['削除']);
      removeBtn.addEventListener('click', () => store.dispatch({ type: 'CLEAR_PHOTO' }));
      previewRow.replaceChildren(
        el('span', { class: 'photo-preview__name' }, [state.photo.fileName]),
        removeBtn,
      );
    } else {
      previewRow.replaceChildren();
    }
  }
  return { root, update };
}

// ---------------------------------------------------------------------------
// 2. Text & shape block
// ---------------------------------------------------------------------------
function buildContentBlock(store: Store): Block {
  const { root, body } = panel('TEXT & SHAPE / 文字・図形');

  const headingInput = el('textarea', {
    id: 'heading-input',
    class: 'text-input',
    rows: '2',
    maxlength: '40',
    placeholder: '大見出し（任意・1〜2行）',
    'aria-label': '見出し',
  }) as HTMLTextAreaElement;
  const subInput = el('input', {
    id: 'subtext-input',
    type: 'text',
    class: 'text-input',
    maxlength: '60',
    placeholder: 'サブテキスト（任意）',
    'aria-label': 'サブテキスト',
  }) as HTMLInputElement;

  headingInput.addEventListener('input', () =>
    store.dispatch({ type: 'SET_HEADING', value: headingInput.value }),
  );
  subInput.addEventListener('input', () =>
    store.dispatch({ type: 'SET_SUBTEXT', value: subInput.value }),
  );

  const shapeGroup = buildButtonRadioGroup(
    'shape',
    [
      { value: 'none', label: 'なし' },
      { value: 'circle', label: '円' },
      { value: 'band', label: '帯' },
      { value: 'triangle', label: '三角形' },
    ],
    (value) => store.dispatch({ type: 'SET_SHAPE', value: value as ShapeKind }),
  );

  const layoutGroup = buildButtonRadioGroup(
    'layout',
    [
      { value: 'center', label: '中央大見出し' },
      { value: 'diagonal', label: '対角ブロック' },
      { value: 'stamp', label: 'フッターバナー' },
    ],
    (value) => store.dispatch({ type: 'SET_LAYOUT', value: value as LayoutPreset }),
  );

  body.append(
    el('label', { class: 'field-label', for: 'heading-input' }, ['見出し']),
    headingInput,
    el('label', { class: 'field-label', for: 'subtext-input' }, ['サブテキスト']),
    subInput,
    el('p', { class: 'field-label' }, ['図形アクセント']),
    shapeGroup.root,
    el('p', { class: 'field-label' }, ['レイアウトプリセット']),
    layoutGroup.root,
  );

  function update(state: AppState) {
    if (document.activeElement !== headingInput && headingInput.value !== state.heading) {
      headingInput.value = state.heading;
    }
    if (document.activeElement !== subInput && subInput.value !== state.subtext) {
      subInput.value = state.subtext;
    }
    shapeGroup.update(state.shape);
    layoutGroup.update(state.layout);
  }
  return { root, update };
}

// ---------------------------------------------------------------------------
// 3. Ink selection block
// ---------------------------------------------------------------------------
function buildInkBlock(store: Store): Block {
  const { root, body } = panel(`INK PLATES / インク版（${MIN_INKS}〜${MAX_INKS}色）`, 'panel-ink');
  const notice = el('p', { class: 'field-notice', role: 'status', 'aria-live': 'polite' }, []) as HTMLParagraphElement;
  const grid = el('div', { class: 'ink-grid' });
  const swatches = new Map<InkId, { wrapper: HTMLElement; input: HTMLInputElement }>();

  for (const ink of INK_PRESETS) {
    const input = el('input', {
      type: 'checkbox',
      class: 'visually-hidden ink-swatch__input',
      value: ink.id,
      'aria-label': ink.label,
    }) as HTMLInputElement;
    const box = el('span', { class: 'ink-swatch__box' });
    box.style.backgroundColor = ink.hex;
    const wrapper = el('label', { class: 'ink-swatch' }, [
      input,
      box,
      el('span', { class: 'ink-swatch__label' }, [ink.label]),
    ]);
    input.addEventListener('change', () => {
      store.dispatch({ type: 'TOGGLE_INK', id: ink.id });
    });
    grid.append(wrapper);
    swatches.set(ink.id, { wrapper, input });
  }

  const textPlateLabel = el('p', { class: 'field-label' }, ['文字・図形の版（ベタ塗り）']);
  const textPlateGroup = el('div', {
    class: 'button-group',
    role: 'radiogroup',
    'aria-label': '文字・図形をどの版に割り当てるか',
  });

  body.append(notice, grid, textPlateLabel, textPlateGroup);

  function update(state: AppState) {
    for (const ink of INK_PRESETS) {
      const { wrapper, input } = swatches.get(ink.id)!;
      const selected = state.selectedInks.includes(ink.id);
      const disabled = !selected && state.selectedInks.length >= MAX_INKS;
      input.checked = selected;
      input.disabled = disabled;
      wrapper.dataset.selected = String(selected);
      wrapper.dataset.disabled = String(disabled);
    }
    notice.textContent = state.inkLimitNotice ?? '';
    notice.classList.toggle('is-visible', Boolean(state.inkLimitNotice));

    textPlateGroup.replaceChildren();
    for (const id of state.selectedInks) {
      const ink = INK_MAP[id];
      const inputId = `textplate-${id}`;
      const input = el('input', {
        type: 'radio',
        name: 'textplate',
        id: inputId,
        value: id,
        class: 'visually-hidden button-group__input',
      }) as HTMLInputElement;
      input.checked = state.textPlateInk === id;
      input.addEventListener('change', () => {
        if (input.checked) store.dispatch({ type: 'SET_TEXT_PLATE_INK', id });
      });
      const label = el('label', { for: inputId, class: 'button-group__option' }, [ink.label]);
      textPlateGroup.append(input, label);
    }
  }
  return { root, update };
}

// ---------------------------------------------------------------------------
// 4. Plate stack info block (read-only, height varies with plate count)
// ---------------------------------------------------------------------------
function buildPlateInfoBlock(store: Store): Block {
  const { root, body } = panel('PLATE STACK / 版構成', 'panel-plates');
  const rowsContainer = el('div', { class: 'plate-rows' });
  const angleInput = el('input', {
    type: 'range',
    id: 'angle-spread',
    min: '0',
    max: '200',
    step: '5',
  }) as HTMLInputElement;
  const angleValue = el('span', { class: 'field-value' }, []);
  angleInput.addEventListener('input', () =>
    store.dispatch({ type: 'SET_ANGLE_SPREAD', value: Number(angleInput.value) }),
  );

  body.append(
    rowsContainer,
    el('label', { class: 'field-label', for: 'angle-spread' }, ['網点角度スプレッド']),
    el('div', { class: 'slider-row' }, [angleInput, angleValue]),
  );

  const roleLabels2 = ['シャドウ寄り', 'ハイライト寄り'];
  const roleLabels3 = ['シャドウ', 'ミッド', 'ハイライト'];

  function update(state: AppState) {
    const plates = buildPlates(
      state.selectedInks,
      state.angleSpread,
      state.misregistrationStrength,
      state.registrationSeed,
    );
    const roleLabels = plates.length === 2 ? roleLabels2 : roleLabels3;
    rowsContainer.replaceChildren(
      ...plates.map((p) => {
        const chip = el('span', { class: 'plate-row__chip' });
        chip.style.backgroundColor = p.hex;
        return el('div', { class: 'plate-row' }, [
          chip,
          el('span', { class: 'plate-row__name' }, [INK_MAP[p.ink].label]),
          el('span', { class: 'plate-row__role' }, [roleLabels[p.bandIndex] ?? '']),
          el('span', { class: 'plate-row__angle' }, [`${p.angleDeg.toFixed(0)}°`]),
        ]);
      }),
    );
    if (document.activeElement !== angleInput) angleInput.value = String(state.angleSpread);
    angleValue.textContent = `${state.angleSpread}%`;
  }
  return { root, update };
}

// ---------------------------------------------------------------------------
// 5. Misregistration block
// ---------------------------------------------------------------------------
function buildRegistrationBlock(store: Store): Block {
  const { root, body } = panel('MISREGISTRATION / 版ズレ');
  const strengthInput = el('input', {
    type: 'range',
    id: 'misreg-strength',
    min: '0',
    max: '100',
    step: '1',
  }) as HTMLInputElement;
  const strengthValue = el('span', { class: 'field-value' }, []);
  strengthInput.addEventListener('input', () =>
    store.dispatch({ type: 'SET_MISREGISTRATION', value: Number(strengthInput.value) }),
  );
  const reshuffleBtn = el('button', { type: 'button', class: 'btn' }, ['版ズレを振り直す']);
  reshuffleBtn.addEventListener('click', () => store.dispatch({ type: 'RESHUFFLE_SEED' }));

  body.append(
    el('label', { class: 'field-label', for: 'misreg-strength' }, ['版ズレ強度']),
    el('div', { class: 'slider-row' }, [strengthInput, strengthValue]),
    reshuffleBtn,
  );

  function update(state: AppState) {
    if (document.activeElement !== strengthInput) {
      strengthInput.value = String(state.misregistrationStrength);
    }
    strengthValue.textContent = `${state.misregistrationStrength}`;
  }
  return { root, update };
}

// ---------------------------------------------------------------------------
// 6. Paper block
// ---------------------------------------------------------------------------
function buildPaperBlock(store: Store): Block {
  const { root, body } = panel('PAPER / 用紙');
  const toneInput = el('input', {
    type: 'range',
    id: 'paper-tone',
    min: '0',
    max: '100',
    step: '1',
  }) as HTMLInputElement;
  const toneValue = el('span', { class: 'field-value' }, []);
  toneInput.addEventListener('input', () =>
    store.dispatch({ type: 'SET_PAPER_TONE', value: Number(toneInput.value) }),
  );

  const grainInput = el('input', {
    type: 'range',
    id: 'paper-grain',
    min: '0',
    max: '100',
    step: '1',
  }) as HTMLInputElement;
  const grainValue = el('span', { class: 'field-value' }, []);
  grainInput.addEventListener('input', () =>
    store.dispatch({ type: 'SET_PAPER_GRAIN', value: Number(grainInput.value) }),
  );

  const marksBtn = el('button', { type: 'button', class: 'btn toggle-btn' }, []) as HTMLButtonElement;
  marksBtn.addEventListener('click', () => store.dispatch({ type: 'TOGGLE_REGISTRATION_MARKS' }));

  body.append(
    el('label', { class: 'field-label', for: 'paper-tone' }, ['トーン（暖色 ↔ 寒色）']),
    el('div', { class: 'slider-row' }, [toneInput, toneValue]),
    el('label', { class: 'field-label', for: 'paper-grain' }, ['粒状ノイズ']),
    el('div', { class: 'slider-row' }, [grainInput, grainValue]),
    marksBtn,
  );

  function update(state: AppState) {
    if (document.activeElement !== toneInput) toneInput.value = String(state.paperTone);
    toneValue.textContent = `${state.paperTone}`;
    if (document.activeElement !== grainInput) grainInput.value = String(state.paperGrain);
    grainValue.textContent = `${state.paperGrain}`;
    marksBtn.setAttribute('aria-pressed', String(state.showRegistrationMarks));
    marksBtn.textContent = state.showRegistrationMarks ? 'トンボ（見当マーク）: 表示' : 'トンボ（見当マーク）: 非表示';
    marksBtn.classList.toggle('is-active', state.showRegistrationMarks);
  }
  return { root, update };
}

// ---------------------------------------------------------------------------
// 7. Output / export block
// ---------------------------------------------------------------------------
function buildOutputBlock(store: Store): Block {
  const { root, body } = panel('OUTPUT / 書き出し', 'panel-output');

  const aspectGroup = buildButtonRadioGroup(
    'aspect',
    [
      { value: 'portrait', label: '縦長ポスター' },
      { value: 'square', label: '正方形' },
    ],
    (value) => store.dispatch({ type: 'SET_ASPECT', value: value as AspectId }),
  );

  const scaleGroup = buildButtonRadioGroup(
    'scale',
    [
      { value: '1', label: '1x' },
      { value: '2', label: '2x' },
      { value: '3', label: '3x' },
    ],
    (value) => store.dispatch({ type: 'SET_EXPORT_SCALE', value: Number(value) as ExportScale }),
  );

  const exportBtn = el('button', { type: 'button', class: 'btn btn-primary btn-export' }, [
    'PNGを書き出す',
  ]) as HTMLButtonElement;
  const statusText = el('p', { class: 'field-notice', role: 'status', 'aria-live': 'polite' }, []) as HTMLParagraphElement;

  let messageTimeout: number | undefined;
  function setTransientMessage(msg: string) {
    statusText.textContent = msg;
    statusText.classList.add('is-visible');
    statusText.dataset.transient = 'true';
    window.clearTimeout(messageTimeout);
    messageTimeout = window.setTimeout(() => {
      statusText.dataset.transient = 'false';
      update(store.getState());
    }, 2600);
  }

  exportBtn.addEventListener('click', () => {
    const state = store.getState();
    if (!hasContent(state) || state.isExporting) return;
    store.dispatch({ type: 'SET_EXPORTING', value: true });
    void (async () => {
      try {
        const blob = await exportPosterPNG(store.getState());
        const s = store.getState();
        downloadBlob(blob, `riso-poster-${s.aspect}-${s.exportScale}x.png`);
        setTransientMessage('書き出しが完了しました。ダウンロードを確認してください');
      } catch {
        setTransientMessage('書き出しに失敗しました。もう一度お試しください');
      } finally {
        store.dispatch({ type: 'SET_EXPORTING', value: false });
      }
    })();
  });

  body.append(
    el('p', { class: 'field-label' }, ['縦横比']),
    aspectGroup.root,
    el('p', { class: 'field-label' }, ['書き出し解像度']),
    scaleGroup.root,
    exportBtn,
    statusText,
  );

  function update(state: AppState) {
    aspectGroup.update(state.aspect);
    scaleGroup.update(String(state.exportScale));
    const ready = hasContent(state);
    exportBtn.disabled = !ready || state.isExporting;
    exportBtn.textContent = state.isExporting ? '書き出し中…' : 'PNGを書き出す';
    if (statusText.dataset.transient === 'true') return;
    if (state.isExporting) {
      statusText.textContent = '全工程（分版・網点化・版ズレ・重ね刷り・用紙質感）を再実行しています…';
      statusText.classList.add('is-visible');
    } else if (!ready) {
      statusText.textContent = '写真かテキスト・図形を追加してください';
      statusText.classList.add('is-visible');
    } else {
      statusText.textContent = '';
      statusText.classList.remove('is-visible');
    }
  }
  return { root, update };
}

// ---------------------------------------------------------------------------
export function mountControls(root: HTMLElement, store: Store): void {
  const blocks: Block[] = [
    buildPhotoBlock(store),
    buildContentBlock(store),
    buildInkBlock(store),
    buildPlateInfoBlock(store),
    buildRegistrationBlock(store),
    buildPaperBlock(store),
    buildOutputBlock(store),
  ];
  root.append(...blocks.map((b) => b.root));

  function updateAll() {
    const state = store.getState();
    for (const b of blocks) b.update(state);
  }
  store.subscribe(updateAll);
  updateAll();
}
