import '@fontsource-variable/fraunces/standard.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './styles.css';

import { store } from './store';
import { el } from './ui/dom';
import { mountSnowfall } from './ui/snowfall';
import { mountWedgeCanvas } from './ui/wedgeCanvas';
import { mountThumbnail, mountExpandedView } from './ui/preview';
import { mountFoldIntro } from './ui/foldIntro';
import { mountToolbar } from './ui/toolbar';
import { mountCutList } from './ui/cutList';
import { mountInspector } from './ui/inspector';
import { mountPresetPanel } from './ui/presetPanel';
import { mountExportPanel } from './ui/exportPanel';
import { showToast } from './ui/toast';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app root not found');

app.append(el('div', { class: 'snow-root' }));

const header = el('header', { class: 'app-header' }, [
  el('div', { class: 'brand' }, [
    el('h1', { class: 'brand__title' }, ['紙雪の結晶スタジオ']),
    el('p', { class: 'brand__sub' }, ['Kirigami Snowflake Studio']),
  ]),
]);

const headerActions = el('div', { class: 'header-actions' });
const replayBtn = el('button', { class: 'btn-ghost', type: 'button' }, ['折り方を見る']);
const undoBtn = el('button', { class: 'btn-icon', type: 'button', 'aria-label': '元に戻す', title: '元に戻す (Ctrl/Cmd+Z)' }, ['↶']);
const redoBtn = el('button', { class: 'btn-icon', type: 'button', 'aria-label': 'やり直す', title: 'やり直す (Ctrl/Cmd+Shift+Z)' }, ['↷']);
const openToggle = el('button', { class: 'btn-toggle', type: 'button' }, ['開く']);
headerActions.append(replayBtn, undoBtn, redoBtn, openToggle);
header.append(headerActions);
app.append(header);

const main = el('main', { class: 'app-main' });
app.append(main);

const toolbarRail = el('aside', { class: 'toolbar-rail', id: 'toolbar-rail' }, [
  el('h2', { class: 'panel-heading' }, ['道具箱']),
]);
main.append(toolbarRail);

const canvasStage = el('section', { class: 'canvas-stage' });
const paperBacking = el('div', { class: 'paper-backing' });
const wedgeMount = el('div', { class: 'wedge-mount' });
const expandedMount = el('div', { class: 'expanded-mount' });
const medallion = el('div', { class: 'preview-medallion' }, [el('span', { class: 'preview-medallion__label' }, ['プレビュー'])]);
const thumbMount = el('div', { class: 'thumb-mount' });
medallion.prepend(thumbMount);
canvasStage.append(paperBacking, wedgeMount, expandedMount, medallion);
main.append(canvasStage);

const sidePanel = el('aside', { class: 'side-panel', id: 'side-panel' });
const presetSection = el('section', { class: 'panel-block' }, [el('h2', { class: 'panel-heading' }, ['デザインを選ぶ'])]);
const presetMount = el('div', { class: 'preset-mount' });
presetSection.append(presetMount);

const cutListSection = el('section', { class: 'panel-block' }, [el('h2', { class: 'panel-heading' }, ['切り込みリスト'])]);
const cutListMount = el('div', { class: 'cutlist-mount' });
cutListSection.append(cutListMount);

const inspectorSection = el('section', { class: 'panel-block' }, [el('h2', { class: 'panel-heading' }, ['詳細調整'])]);
const inspectorMount = el('div', { class: 'inspector-mount' });
inspectorSection.append(inspectorMount);

const exportSection = el('section', { class: 'panel-block' }, [el('h2', { class: 'panel-heading' }, ['書き出す'])]);
const exportMount = el('div', { class: 'export-mount' });
exportSection.append(exportMount);

sidePanel.append(presetSection, cutListSection, inspectorSection, exportSection);
main.append(sidePanel);

// mobile bottom-sheet controls
const mobileFabs = el('div', { class: 'mobile-fabs' });
const fabTools = el('button', { class: 'fab', type: 'button' }, ['🛠 ツール']);
const fabPanel = el('button', { class: 'fab', type: 'button' }, ['📋 パネル']);
mobileFabs.append(fabTools, fabPanel);
app.append(mobileFabs);

const sheetScrim = el('div', { class: 'sheet-scrim' });
app.append(sheetScrim);

function closeSheets() {
  toolbarRail.classList.remove('sheet-open');
  sidePanel.classList.remove('sheet-open');
  sheetScrim.classList.remove('sheet-scrim--visible');
  fabTools.classList.remove('fab--active');
  fabPanel.classList.remove('fab--active');
}

fabTools.addEventListener('click', () => {
  const willOpen = !toolbarRail.classList.contains('sheet-open');
  closeSheets();
  if (willOpen) {
    toolbarRail.classList.add('sheet-open');
    sheetScrim.classList.add('sheet-scrim--visible');
    fabTools.classList.add('fab--active');
  }
});
fabPanel.addEventListener('click', () => {
  const willOpen = !sidePanel.classList.contains('sheet-open');
  closeSheets();
  if (willOpen) {
    sidePanel.classList.add('sheet-open');
    sheetScrim.classList.add('sheet-scrim--visible');
    fabPanel.classList.add('fab--active');
  }
});
sheetScrim.addEventListener('click', closeSheets);

// mount interactive pieces
mountSnowfall(document.querySelector('.snow-root') as HTMLElement);
mountToolbar(toolbarRail);
const canvasHandle = mountWedgeCanvas(wedgeMount);
mountThumbnail(thumbMount);
const expandedView = mountExpandedView(expandedMount);
mountCutList(cutListMount);
mountInspector(inspectorMount);
mountPresetPanel(presetMount);
mountExportPanel(exportMount);

const foldIntro = mountFoldIntro(canvasStage);
replayBtn.addEventListener('click', () => foldIntro.play());
window.setTimeout(() => foldIntro.play(), 260);

function updateUndoRedoButtons() {
  undoBtn.toggleAttribute('disabled', !store.canUndo);
  redoBtn.toggleAttribute('disabled', !store.canRedo);
}
undoBtn.addEventListener('click', () => store.undo());
redoBtn.addEventListener('click', () => store.redo());
store.subscribe(updateUndoRedoButtons);
updateUndoRedoButtons();

function setViewMode(mode: 'wedge' | 'expanded') {
  store.setViewMode(mode);
  if (mode === 'expanded') {
    canvasStage.classList.add('canvas-stage--expanded');
    openToggle.textContent = 'たたむ';
    expandedView.playOpen();
  } else {
    canvasStage.classList.remove('canvas-stage--expanded');
    openToggle.textContent = '開く';
    expandedView.playClose();
  }
}
openToggle.addEventListener('click', () => {
  setViewMode(store.viewMode === 'wedge' ? 'expanded' : 'wedge');
});

// keyboard shortcuts
window.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement;
  const isFormField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) store.redo();
    else store.undo();
    return;
  }
  if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    store.redo();
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && store.selectedId && !isFormField) {
    e.preventDefault();
    store.removeCut(store.selectedId);
    showToast({ message: '切り込みを削除しました' });
    return;
  }
  if (e.key === 'Escape') {
    store.select(null);
    closeSheets();
  }
});

// reflect invalid-placement shake feedback from anywhere that needs it
void canvasHandle;
