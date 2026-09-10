import { exportPng, exportSvg, type PngBackground } from '../export';
import { store } from '../store';
import { el } from './dom';
import { showToast } from './toast';

const SIZES = [
  { label: '1024 px', value: 1024 },
  { label: '2048 px', value: 2048 },
  { label: '4096 px', value: 4096 },
];

export function mountExportPanel(container: HTMLElement): void {
  let size = SIZES[1].value;
  let background: PngBackground = 'mat';

  const svgBtn = el('button', { class: 'export-btn export-btn--svg', type: 'button' }, [
    el('span', {}, ['型紙 SVG を書き出す']),
    el('span', { class: 'export-btn__hint' }, ['印刷してハサミで切り抜ける線画']),
  ]);
  svgBtn.addEventListener('click', () => {
    if (store.cuts.length === 0) {
      showToast({ message: '切り込みを配置してから書き出してください', tone: 'error' });
      return;
    }
    exportSvg(store.cuts);
    showToast({ message: 'SVG 型紙を書き出しました' });
  });

  const sizeRow = el('div', { class: 'size-row' });
  SIZES.forEach((s) => {
    const b = el('button', { class: `size-btn ${s.value === size ? 'size-btn--active' : ''}`, type: 'button' }, [s.label]);
    b.addEventListener('click', () => {
      size = s.value;
      sizeRow.querySelectorAll('.size-btn').forEach((n) => n.classList.remove('size-btn--active'));
      b.classList.add('size-btn--active');
    });
    sizeRow.append(b);
  });

  const bgRow = el('div', { class: 'size-row' });
  const bgOptions: { id: PngBackground; label: string }[] = [
    { id: 'mat', label: '深紺の作業台' },
    { id: 'transparent', label: '透過' },
  ];
  bgOptions.forEach((opt) => {
    const b = el('button', { class: `size-btn ${opt.id === background ? 'size-btn--active' : ''}`, type: 'button' }, [opt.label]);
    b.addEventListener('click', () => {
      background = opt.id;
      bgRow.querySelectorAll('.size-btn').forEach((n) => n.classList.remove('size-btn--active'));
      b.classList.add('size-btn--active');
    });
    bgRow.append(b);
  });

  const pngBtn = el('button', { class: 'export-btn export-btn--png', type: 'button' }, [
    el('span', { class: 'export-btn__text' }, ['完成イメージ PNG を書き出す']),
  ]);

  pngBtn.addEventListener('click', async () => {
    if (store.cuts.length === 0) {
      showToast({ message: '切り込みを配置してから書き出してください', tone: 'error' });
      return;
    }
    const spinnerTimer = window.setTimeout(() => pngBtn.classList.add('export-btn--loading'), 150);
    pngBtn.disabled = true;
    try {
      await exportPng(store.cuts, size, background);
      showToast({ message: `PNG（${size}px）を書き出しました` });
    } catch {
      showToast({ message: 'PNG の書き出しに失敗しました', tone: 'error' });
    } finally {
      window.clearTimeout(spinnerTimer);
      pngBtn.classList.remove('export-btn--loading');
      pngBtn.disabled = false;
    }
  });

  container.append(
    svgBtn,
    el('div', { class: 'export-divider' }),
    el('p', { class: 'field-label' }, ['PNG の解像度']),
    sizeRow,
    el('p', { class: 'field-label' }, ['背景']),
    bgRow,
    pngBtn,
  );
}
