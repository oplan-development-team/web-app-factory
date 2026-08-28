import './style.css';
import '@fontsource/vt323';
import '@fontsource/dotgothic16';
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/600.css';
import '@fontsource/zen-kaku-gothic-new/400.css';
import '@fontsource/zen-kaku-gothic-new/500.css';

import type { Fragment, ToggleState } from './types';
import { registerGlobalPaste } from './paste';
import { generatePoem, resetPoemCounter, truncateForPrint } from './poem';
import { copyPoemToClipboard, exportPoemAsPng } from './export';
import { CHASSIS_MARKUP, appendFragmentEntry, appendPoemStamp, typewriterReveal } from './render';

const desk = document.querySelector<HTMLElement>('.desk');
if (!desk) throw new Error('desk root missing');
desk.innerHTML = CHASSIS_MARKUP;

const ledDigits = document.getElementById('led-digits') as HTMLElement;
const ledStatus = document.getElementById('led-status') as HTMLElement;
const ledScreen = document.getElementById('led-screen') as HTMLElement;
const paperFeed = document.getElementById('paper-feed') as HTMLElement;
const paperContent = document.getElementById('paper-content') as HTMLElement;
const paperEmpty = document.getElementById('paper-empty') as HTMLElement;
const printButton = document.getElementById('print-button') as HTMLButtonElement;
const cutButton = document.getElementById('cut-button') as HTMLButtonElement;
const toggleButtons: Record<keyof ToggleState, HTMLButtonElement> = {
  lineBreak: document.getElementById('toggle-lineBreak') as HTMLButtonElement,
  trim: document.getElementById('toggle-trim') as HTMLButtonElement,
  shuffle: document.getElementById('toggle-shuffle') as HTMLButtonElement,
};

const fragments: Fragment[] = [];
const toggles: ToggleState = { lineBreak: true, trim: true, shuffle: true };
let fragmentCounter = 0;
let statusResetTimer: number | undefined;
let isBusy = false; // guards overlapping typewriter reveals / cut animation

function setStatus(text: string, opts: { alert?: boolean; revertMs?: number } = {}): void {
  window.clearTimeout(statusResetTimer);
  ledStatus.textContent = text;
  ledScreen.classList.toggle('is-alert', Boolean(opts.alert));
  if (opts.revertMs) {
    statusResetTimer = window.setTimeout(() => {
      ledScreen.classList.remove('is-alert');
      ledStatus.textContent = fragments.length > 0 ? 'READY' : 'PASTE TO BEGIN';
    }, opts.revertMs);
  }
}

function updateCounter(): void {
  ledDigits.textContent = String(fragments.length).padStart(2, '0');
}

function updateButtons(): void {
  printButton.disabled = fragments.length === 0 || isBusy;
  cutButton.disabled = fragments.length === 0 || isBusy;
}

function ensureEmptyStateRemoved(): void {
  if (paperEmpty.isConnected) paperEmpty.remove();
}

async function handleAddFragment(text: string): Promise<void> {
  fragmentCounter += 1;
  const { printed, truncated } = truncateForPrint(text);
  const fragment: Fragment = {
    id: fragmentCounter,
    fullText: text,
    printedText: printed,
    truncated,
    pastedAt: Date.now(),
  };
  fragments.push(fragment);
  ensureEmptyStateRemoved();
  updateCounter();
  setStatus('PRINTING…');

  isBusy = true;
  updateButtons();
  const { textEl, onDone } = appendFragmentEntry(paperContent, fragment, fragments.length);
  paperFeed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  await typewriterReveal(textEl, fragment.printedText);
  onDone();
  isBusy = false;
  setStatus('READY');
  updateButtons();
}

registerGlobalPaste((result) => {
  if (result.kind === 'unsupported') {
    setStatus('UNSUPPORTED FORMAT', { alert: true, revertMs: 2200 });
    return;
  }
  if (result.kind === 'empty') {
    setStatus('EMPTY — IGNORED', { alert: true, revertMs: 1800 });
    return;
  }
  void handleAddFragment(result.text);
});

function setToggle(key: keyof ToggleState, value: boolean): void {
  toggles[key] = value;
  const btn = toggleButtons[key];
  btn.setAttribute('aria-pressed', String(value));
}

(Object.keys(toggleButtons) as (keyof ToggleState)[]).forEach((key) => {
  toggleButtons[key].addEventListener('click', () => setToggle(key, !toggles[key]));
});

printButton.addEventListener('click', () => {
  const poem = generatePoem(fragments, toggles);
  if (!poem) return;
  printButton.classList.add('is-firing');
  window.setTimeout(() => printButton.classList.remove('is-firing'), 260);
  setStatus(`PRINTED POEM No.${String(poem.id).padStart(2, '0')}`, { revertMs: 2200 });
  appendPoemStamp(paperContent, poem, {
    onCopy: () => {
      void copyPoemToClipboard(poem);
    },
    onPng: () => {
      void exportPoemAsPng(poem);
    },
  });
  updateButtons();
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
});

cutButton.addEventListener('click', () => {
  if (isBusy) return;
  if (fragments.length === 0 && paperContent.children.length <= 1) return;
  isBusy = true;
  updateButtons();
  paperFeed.classList.add('is-cutting');
  const finishCut = () => {
    paperFeed.classList.remove('is-cutting');
    paperFeed.removeEventListener('animationend', finishCut);
    fragments.length = 0;
    fragmentCounter = 0;
    resetPoemCounter();
    paperContent.innerHTML = '';
    paperContent.appendChild(paperEmpty);
    updateCounter();
    setStatus('CUT — CLEARED');
    window.setTimeout(() => setStatus('PASTE TO BEGIN'), 1400);
    isBusy = false;
    updateButtons();
  };
  paperFeed.addEventListener('animationend', finishCut);
});

updateCounter();
updateButtons();
