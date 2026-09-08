import { PRESETS } from '../presets';
import { store } from '../store';
import { el } from './dom';
import { showToast } from './toast';

export function mountPresetPanel(container: HTMLElement): void {
  const grid = el('div', { class: 'preset-grid' });
  container.append(grid);

  PRESETS.forEach((preset) => {
    const btn = el('button', { class: 'preset-card', type: 'button' }, [
      el('span', { class: 'preset-card__name' }, [preset.name]),
      el('span', { class: 'preset-card__desc' }, [preset.description]),
    ]);
    btn.addEventListener('click', () => {
      const hadCuts = store.cuts.length > 0;
      store.loadPreset(preset.build());
      if (hadCuts) {
        showToast({
          message: `デザイン「${preset.name}」を読み込みました。`,
          actionLabel: '元に戻す',
          onAction: () => store.undo(),
        });
      } else {
        showToast({ message: `デザイン「${preset.name}」を読み込みました。` });
      }
    });
    grid.append(btn);
  });
}
