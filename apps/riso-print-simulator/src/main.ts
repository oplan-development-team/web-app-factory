import '@fontsource/archivo-black';
import '@fontsource/anton/400.css';
import './style.css';

import { createInitialState, createStore } from './state';
import { INK_MAP } from './types';
import { DISPLAY_FONT_FAMILY } from './core/content';
import { el } from './ui/dom';
import { mountControls } from './ui/controls';
import { mountPreview } from './ui/canvasPanel';

const store = createStore(createInitialState());

const appRoot = document.getElementById('app');
if (!appRoot) throw new Error('#app root element not found');

const shell = el('div', { class: 'app-shell' });

const masthead = el('header', { class: 'masthead' }, [
  el('div', { class: 'masthead__mark' }, ['RPS-01']),
  el('div', { class: 'masthead__title-group' }, [
    el('h1', { class: 'masthead__title' }, ['RISO PRINT SIMULATOR']),
    el('p', { class: 'masthead__subtitle' }, [
      'リソグラフ再現ポスターメーカー — 写真・文字・図形を2〜3色のインク版に分解し、角度違いの網点と版ズレでブラウザ内重ね刷りを再現',
    ]),
  ]),
  el('div', { class: 'masthead__badge' }, ['PROTOTYPE']),
]);

const workspace = el('div', { class: 'workspace' });
const controlsCol = el('div', { class: 'controls-col' });
const previewCol = el('div', { class: 'preview-col' });
// Preview comes first in DOM so it's reachable immediately on mobile (single
// -column stack) without scrolling past every control panel first. Desktop
// restores the intended left-controls/right-preview order via CSS `order`.
workspace.append(previewCol, controlsCol);

shell.append(masthead, workspace);
appRoot.replaceChildren(shell);

mountControls(controlsCol, store);
const preview = mountPreview(previewCol, store);

function applyAccent() {
  const accentInk = INK_MAP[store.getState().selectedInks[0]];
  document.documentElement.style.setProperty('--accent', accentInk.hex);
}
applyAccent();
store.subscribe(applyAccent);

// Canvas text does NOT automatically trigger a @font-face fetch the way DOM
// text does (document.fonts.ready alone never resolves for a family that has
// never been used in the DOM). Anton is only ever drawn via ctx.fillText, so
// we must explicitly request it via the Font Loading API — otherwise every
// poster headline would silently render in the CSS fallback font forever.
if ('fonts' in document) {
  Promise.all([
    document.fonts.load(`16px "${DISPLAY_FONT_FAMILY}"`, 'AaZz0123'),
    document.fonts.ready,
  ])
    .catch(() => {
      // Offline / blocked fetch — canvas keeps using the system fallback chain.
    })
    .then(() => preview.scheduleRender());
}
