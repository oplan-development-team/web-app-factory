import { el } from './dom';

export interface UploadViewCallbacks {
  onFile: (file: File) => void;
}

export function renderUploadScreen(cb: UploadViewCallbacks): HTMLElement {
  const input = el('input', {
    type: 'file',
    accept: 'image/jpeg,image/png',
    className: 'visually-hidden',
    id: 'file-input',
  }) as HTMLInputElement;

  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (f) cb.onFile(f);
    input.value = '';
  });

  const dropzone = el(
    'label',
    { className: 'dropzone', for: 'file-input', tabIndex: 0 },
    [
      el('div', { className: 'dropzone__seal-hint' }, ['受理窓口']),
      el('p', { className: 'dropzone__title' }, ['写真をここに提出（ドラッグ&ドロップ）']),
      el('p', { className: 'dropzone__sub' }, ['またはクリックしてファイルを選択　─　JPEG / PNG・1枚のみ']),
      el('div', { className: 'dropzone__stampline' }, ['提出 ＝ 端末内解析のみ／外部送信なし']),
    ],
  );

  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });

  let dragCounter = 0;
  dropzone.addEventListener('dragover', (e) => e.preventDefault());
  dropzone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dropzone.classList.add('dropzone--active');
  });
  dropzone.addEventListener('dragleave', () => {
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0) dropzone.classList.remove('dropzone--active');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dropzone.classList.remove('dropzone--active');
    const f = e.dataTransfer?.files?.[0];
    if (f) cb.onFile(f);
  });

  return el('div', { className: 'stage stage-upload' }, [
    el('header', { className: 'intro' }, [
      el('p', { className: 'intro__eyebrow' }, ['個人情報開示リスク判定システム（模擬）']),
      el('h1', { className: 'intro__title' }, ['黒塗りメタデータ開示装置']),
      el('p', { className: 'intro__lede' }, [
        '写真に埋め込まれた撮影日時・GPS座標・端末情報を、情報公開請求の「黒塗り公文書」に見立てて可視化します。処理はすべてこの端末（ブラウザ）内で完結し、画像を外部サーバーへ送信することはありません。',
      ]),
    ]),
    dropzone,
    input,
    el('ul', { className: 'intro__notes' }, [
      el('li', {}, ['対応形式：JPEG / PNG（1枚ずつ）']),
      el('li', {}, ['GPSが検出された場合のみ、地図タイル画像を外部（OpenStreetMap）から1回だけ取得します']),
      el('li', {}, ['除去はバイナリレベルの直接編集で行うため、画素の再圧縮劣化はありません']),
    ]),
  ]);
}

export function renderErrorScreen(message: string, onRetry: () => void): HTMLElement {
  return el('div', { className: 'stage stage-error' }, [
    el('div', { className: 'reject-stamp' }, ['受理不可']),
    el('h2', { className: 'error-title' }, ['ファイルを受理できませんでした']),
    el('p', { className: 'error-body' }, [message]),
    el('button', { type: 'button', className: 'btn btn-outline', onClick: onRetry }, ['窓口に戻る']),
  ]);
}

export function renderAnalyzingScreen(): HTMLElement {
  return el('div', { className: 'stage stage-analyzing' }, [
    el('div', { className: 'analyzing-card' }, [
      el('p', { className: 'analyzing-card__label' }, ['受付・審査中…']),
      el('div', { className: 'skeleton-line skeleton-line--title' }),
      el('div', { className: 'skeleton-line' }),
      el('div', { className: 'skeleton-line' }),
      el('div', { className: 'skeleton-line skeleton-line--short' }),
    ]),
  ]);
}
