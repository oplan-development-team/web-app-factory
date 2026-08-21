import { computeSky } from './astro/compute';
import { CONSTELLATIONS, STARS } from './catalog';
import { buildPosterSvg } from './render/chart';
import { closeInlineEditor, enableInlineEditing } from './render/editableText';
import { exportPngFile, exportSvgFile } from './render/exportImage';
import { CHART_R } from './render/layout';
import { EDITABLE_IDS, defaultDateLine, defaultPlaceLine, defaultTitle } from './render/legend';
import { buildSkeletonSvg } from './render/skeleton';
import { formatDate } from './render/format';
import type { PosterInputs, PosterTextOverrides } from './types';
import { requireElement } from './ui/dom';
import {
  applyFieldErrors,
  fillDefaultValues,
  queryFormElements,
  readInputs,
  type FormElements,
} from './ui/form';
import { requestCurrentPosition } from './ui/geolocation';
import { StatusRegion } from './ui/status';

/**
 * How long to wait after the last keystroke before recomputing. Long enough
 * that dragging a number spinner does not queue a render per tick, short
 * enough that the chart still feels tied to the control (FR-009.1).
 */
export const RENDER_DEBOUNCE_MS = 120;

export type PosterState = 'loading' | 'ready' | 'invalid';

/** Which of the three editable poster texts the user has taken over. */
interface DirtyFlags {
  title: boolean;
  date: boolean;
  place: boolean;
}

export interface AppHandle {
  /** Recomputes immediately, bypassing the debounce. Used by tests and by geolocation. */
  renderNow(): void;
  get state(): PosterState;
  destroy(): void;
}

interface AppElements {
  form: FormElements;
  frame: HTMLDivElement;
  mount: HTMLDivElement;
  overlayTitle: HTMLParagraphElement;
  overlayList: HTMLUListElement;
  geolocateBtn: HTMLButtonElement;
  resetTextBtn: HTMLButtonElement;
  pngScale: HTMLSelectElement;
  exportPng: HTMLButtonElement;
  exportSvg: HTMLButtonElement;
  status: HTMLParagraphElement;
}

function queryAppElements(doc: Document): AppElements {
  return {
    form: queryFormElements(doc),
    frame: requireElement(doc, 'poster-frame', 'div'),
    mount: requireElement(doc, 'poster-mount', 'div'),
    overlayTitle: requireElement(doc, 'poster-overlay-title', 'p'),
    overlayList: requireElement(doc, 'poster-overlay-list', 'ul'),
    geolocateBtn: requireElement(doc, 'geolocate-btn', 'button'),
    resetTextBtn: requireElement(doc, 'reset-text', 'button'),
    pngScale: requireElement(doc, 'png-scale', 'select'),
    exportPng: requireElement(doc, 'export-png', 'button'),
    exportSvg: requireElement(doc, 'export-svg', 'button'),
    status: requireElement(doc, 'status-region', 'p'),
  };
}

/**
 * Wires the whole application together.
 *
 * Taking the document as an argument rather than reaching for the global keeps
 * the wiring -- state transitions, debouncing, export orchestration -- exercisable
 * under jsdom instead of only in a real browser.
 */
export function createApp(doc: Document): AppHandle {
  const el = queryAppElements(doc);
  const status = new StatusRegion(el.status);

  fillDefaultValues(el.form);

  const dirty: DirtyFlags = { title: false, date: false, place: false };
  const overrides: PosterTextOverrides = { title: defaultTitle(), dateLine: '', placeLine: '' };

  let state: PosterState = 'loading';
  let currentSvg: SVGSVGElement | null = null;
  let lastValidInputs: PosterInputs | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;

  // The skeleton occupies the poster's exact aspect ratio from the first
  // paint, so swapping the real chart in later moves nothing (FR-009.2).
  el.mount.replaceChildren(buildSkeletonSvg());
  setState('loading');

  function setState(next: PosterState): void {
    state = next;
    el.frame.dataset['state'] = next;
    const exportsDisabled = next !== 'ready';
    el.exportPng.disabled = exportsDisabled;
    el.exportSvg.disabled = exportsDisabled;
  }

  function showInvalid(messages: readonly string[]): void {
    el.overlayTitle.textContent = '入力を確認してください';
    el.overlayList.replaceChildren(
      ...messages.map((message) => {
        const li = doc.createElement('li');
        li.textContent = message;
        return li;
      }),
    );
    setState('invalid');
  }

  function refreshResetButton(): void {
    el.resetTextBtn.disabled = !(dirty.title || dirty.date || dirty.place);
  }

  function renderNow(): void {
    if (destroyed) return;

    // The poster SVG is replaced wholesale below, so any open editor would be
    // left hovering over a node that no longer exists (FR-007.8).
    closeInlineEditor(doc);

    const result = readInputs(el.form);
    applyFieldErrors(el.form, result.ok ? [] : result.errors);

    if (!result.ok) {
      // The prototype returned here silently, leaving the previous poster on
      // screen with nothing to say why it had stopped updating (FR-004.3).
      showInvalid(result.errors.map((error) => error.message));
      return;
    }

    const inputs = result.value;
    lastValidInputs = inputs;

    if (!dirty.date) overrides.dateLine = defaultDateLine(inputs);
    if (!dirty.place) overrides.placeLine = defaultPlaceLine(inputs);

    const sky = computeSky(inputs, CHART_R, STARS, CONSTELLATIONS);
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
      refreshResetButton();
    });

    el.mount.replaceChildren(svg);
    currentSvg = svg;
    setState('ready');
  }

  function scheduleRender(): void {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderNow, RENDER_DEBOUNCE_MS);
  }

  el.form.form.addEventListener('input', scheduleRender);
  el.form.form.addEventListener('change', scheduleRender);
  // A form with a single control submits on Enter; without this the page
  // would reload and silently discard everything the user had typed.
  el.form.form.addEventListener('submit', (event) => event.preventDefault());

  el.resetTextBtn.addEventListener('click', () => {
    dirty.title = false;
    dirty.date = false;
    dirty.place = false;
    overrides.title = defaultTitle();
    refreshResetButton();
    renderNow();
    status.set('ポスターの表示文言を入力値から再生成しました。', 'success');
  });

  el.geolocateBtn.addEventListener('click', async () => {
    status.set('現在地を取得しています…');
    el.geolocateBtn.disabled = true;
    el.geolocateBtn.setAttribute('aria-busy', 'true');

    try {
      const { latitude, longitude } = await requestCurrentPosition();
      el.form.lat.value = latitude.toFixed(4);
      el.form.lon.value = longitude.toFixed(4);
      renderNow();
      status.set(
        `現在地を取得しました（緯度 ${latitude.toFixed(4)} / 経度 ${longitude.toFixed(4)}）。必要に応じて修正できます。`,
        'success',
      );
    } catch (error) {
      status.set(messageOf(error, '現在地を取得できませんでした。'), 'error');
    } finally {
      el.geolocateBtn.disabled = false;
      el.geolocateBtn.removeAttribute('aria-busy');
    }
  });

  function exportFilename(extension: string): string {
    const slug = overrides.placeLine
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const date =
      lastValidInputs === null
        ? ''
        : `_${formatDate(lastValidInputs.year, lastValidInputs.month, lastValidInputs.day).replace(/\./g, '')}`;
    return `birth-sky-poster_${slug || 'chart'}${date}.${extension}`;
  }

  async function runExport(
    button: HTMLButtonElement,
    label: string,
    run: (svg: SVGSVGElement) => Promise<void>,
  ): Promise<void> {
    if (currentSvg === null) return;

    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    status.set(`${label}を書き出しています…`);

    try {
      await run(currentSvg);
      status.set(`${label}を書き出しました。`, 'success');
    } catch (error) {
      status.set(messageOf(error, `${label}の書き出しに失敗しました。`), 'error');
    } finally {
      button.disabled = state !== 'ready';
      button.removeAttribute('aria-busy');
    }
  }

  el.exportPng.addEventListener('click', () => {
    const scale = Number(el.pngScale.value) || 1;
    void runExport(el.exportPng, 'PNG', (svg) => exportPngFile(svg, exportFilename('png'), scale));
  });

  el.exportSvg.addEventListener('click', () => {
    void runExport(el.exportSvg, 'SVG', (svg) => exportSvgFile(svg, exportFilename('svg')));
  });

  refreshResetButton();
  renderNow();

  return {
    renderNow,
    get state() {
      return state;
    },
    destroy() {
      destroyed = true;
      clearTimeout(debounceTimer);
    },
  };
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message !== '' ? error.message : fallback;
}
