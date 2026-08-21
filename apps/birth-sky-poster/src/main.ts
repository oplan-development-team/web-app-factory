import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './style.css';

import starsData from './data/stars.json';
import constellationsData from './data/constellations.json';
import type { ConstellationRecord, PosterTextOverrides, StarRecord } from './types';
import { computeSky } from './astro/compute';
import { buildPosterSvg } from './render/chart';
import { CHART_R } from './render/layout';
import { EDITABLE_IDS, defaultDateLine, defaultPlaceLine, defaultTitle } from './render/legend';
import { enableInlineEditing } from './render/editableText';
import { exportPngFile, exportSvgFile } from './render/exportImage';
import { fillDefaultValues, queryFormElements, readInputs } from './ui/form';
import { requestCurrentPosition } from './ui/geolocation';

const stars = starsData as StarRecord[];
const constellations = constellationsData as ConstellationRecord[];

const formEl = queryFormElements();
fillDefaultValues(formEl);

const mountEl = document.getElementById('poster-mount');
if (!mountEl) throw new Error('poster-mount element was not found in the document.');
const mount: HTMLElement = mountEl;

// Tracks whether the user has manually overridden each editable poster
// text field; while untouched, the field keeps regenerating from inputs.
const dirty = { title: false, date: false, place: false };
const overrides: PosterTextOverrides = { title: defaultTitle(), dateLine: '', placeLine: '' };

let currentSvg: SVGSVGElement | null = null;

function render(): void {
  const inputs = readInputs(formEl);
  if (!inputs) return;

  if (!dirty.date) overrides.dateLine = defaultDateLine(inputs);
  if (!dirty.place) overrides.placeLine = defaultPlaceLine(inputs);

  const sky = computeSky(inputs, CHART_R, stars, constellations);
  const svg = buildPosterSvg(inputs, sky, overrides);

  enableInlineEditing(svg, (elementId, value) => {
    if (elementId === EDITABLE_IDS.title) {
      overrides.title = value;
      dirty.title = true;
    } else if (elementId === EDITABLE_IDS.date) {
      overrides.dateLine = value;
      dirty.date = true;
    } else if (elementId === EDITABLE_IDS.place) {
      overrides.placeLine = value;
      dirty.place = true;
    }
  });

  mount.replaceChildren(svg);
  currentSvg = svg;
}

formEl.form.addEventListener('input', render);
formEl.form.addEventListener('change', render);

const geoBtn = document.getElementById('geolocate-btn') as HTMLButtonElement;
const geoStatus = document.getElementById('geolocate-status') as HTMLElement;

geoBtn.addEventListener('click', async () => {
  geoStatus.textContent = '現在地を取得中…';
  geoBtn.disabled = true;
  try {
    const { latitude, longitude } = await requestCurrentPosition();
    formEl.lat.value = latitude.toFixed(4);
    formEl.lon.value = longitude.toFixed(4);
    geoStatus.textContent = `取得しました（緯度 ${latitude.toFixed(4)} / 経度 ${longitude.toFixed(4)}）。必要に応じて修正できます。`;
    render();
  } catch (err) {
    geoStatus.textContent = err instanceof Error ? err.message : '現在地を取得できませんでした。';
  } finally {
    geoBtn.disabled = false;
  }
});

const pngScaleSelect = document.getElementById('png-scale') as HTMLSelectElement;
const exportPngBtn = document.getElementById('export-png') as HTMLButtonElement;
const exportSvgBtn = document.getElementById('export-svg') as HTMLButtonElement;

function exportFilenameBase(): string {
  const slug = (overrides.placeLine || 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `birth-sky-poster_${slug || 'chart'}`;
}

exportPngBtn.addEventListener('click', async () => {
  if (!currentSvg) return;
  exportPngBtn.disabled = true;
  try {
    const scale = Number(pngScaleSelect.value) || 1;
    await exportPngFile(currentSvg, `${exportFilenameBase()}.png`, scale);
  } catch (err) {
    window.alert(err instanceof Error ? err.message : 'PNGの書き出しに失敗しました。');
  } finally {
    exportPngBtn.disabled = false;
  }
});

exportSvgBtn.addEventListener('click', async () => {
  if (!currentSvg) return;
  exportSvgBtn.disabled = true;
  try {
    await exportSvgFile(currentSvg, `${exportFilenameBase()}.svg`);
  } catch (err) {
    window.alert(err instanceof Error ? err.message : 'SVGの書き出しに失敗しました。');
  } finally {
    exportSvgBtn.disabled = false;
  }
});

render();
