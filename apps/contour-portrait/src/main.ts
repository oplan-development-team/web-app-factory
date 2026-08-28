import './styles/global.css';
import { Store } from './lib/state';
import { createPanel } from './components/panel';
import { createCanvas } from './components/canvas';
import { GRID_H, GRID_W } from './lib/constants';

const root = document.getElementById('app');
if (!root) throw new Error('#app root element is missing.');

const store = new Store();

const header = document.createElement('header');
header.className = 'app-header';
header.innerHTML = `
  <div class="wordmark">
    <strong>CONTOUR PORTRAIT</strong>
    <span>ISOLINE PORTRAIT SURVEY TOOL</span>
  </div>
  <div class="meta">GRID ${GRID_W}×${GRID_H} · CLIENT-SIDE ONLY</div>
`;

const main = document.createElement('main');
main.className = 'app-main';

const panel = createPanel(store);
const canvas = createCanvas(store);
main.append(panel.el, canvas.el);

root.append(header, main);

store.subscribe(() => {
  panel.update();
  canvas.update();
});

// Initial paint with default settings before any image is loaded.
panel.update();
canvas.update();
