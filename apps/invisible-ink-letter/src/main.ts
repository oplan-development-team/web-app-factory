import './style.css';
import { mountWriteView } from './write-view';
import { mountReadView } from './read-view';

const app = document.getElementById('app');
if (!app) {
  throw new Error('#app root element not found');
}

function goToWrite(): void {
  history.pushState('', document.title, window.location.pathname + window.location.search);
  render();
}

function render(): void {
  const hash = window.location.hash.slice(1);
  if (!hash) {
    mountWriteView(app!);
  } else {
    mountReadView(app!, hash, goToWrite);
  }
}

window.addEventListener('hashchange', render);
render();
