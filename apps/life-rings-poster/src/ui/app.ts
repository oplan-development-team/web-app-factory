import { Store } from '../lib/pubsub';
import { loadPosterData, savePosterData } from '../lib/storage';
import { buildRingModel } from '../lib/rings';
import { renderPosterSVG } from '../lib/geometry';
import { buildStandaloneSvg, downloadSvgFile, rasterizeToPng, triggerDownload, makeFilename } from '../lib/export';
import { WOOD_PALETTES } from '../lib/palette';
import type { EventEntry, PosterData, WoodTone } from '../lib/types';
import { EventListView } from './eventList';

const CURRENT_YEAR = new Date().getFullYear();

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultState(): PosterData {
  return {
    birthYear: null,
    endYear: CURRENT_YEAR,
    title: '',
    subtitle: '',
    woodTone: 'oak',
    events: [],
  };
}

export function mountApp(root: HTMLElement): void {
  const initial = loadPosterData() ?? defaultState();
  const store = new Store<PosterData>(initial);

  root.innerHTML = buildShellMarkup();

  const el = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

  const birthYearInput = el<HTMLInputElement>('#field-birth-year');
  const endYearInput = el<HTMLInputElement>('#field-end-year');
  const titleInput = el<HTMLInputElement>('#field-title');
  const subtitleInput = el<HTMLInputElement>('#field-subtitle');
  const toneGroup = el('#tone-group');
  const eventsContainer = el('#events-container');
  const eventCountHint = el('#event-count-hint');
  const addEventBtn = el<HTMLButtonElement>('#btn-add-event');
  const posterMount = el('#poster-mount');
  const statusLine = el('#status-line');
  const btnExportSvg = el<HTMLButtonElement>('#btn-export-svg');
  const btnExportPngScreen = el<HTMLButtonElement>('#btn-export-png-screen');
  const btnExportPngPrint = el<HTMLButtonElement>('#btn-export-png-print');

  // ---- initial field values -------------------------------------------------
  birthYearInput.value = initial.birthYear === null ? '' : String(initial.birthYear);
  endYearInput.value = String(initial.endYear);
  titleInput.value = initial.title;
  subtitleInput.value = initial.subtitle;

  const eventList = new EventListView(eventsContainer, {
    onYearChange: (id, raw) => updateEvent(id, { year: parseYearLoose(raw) }),
    onLabelChange: (id, raw) => updateEvent(id, { label: raw }),
    onMajorChange: (id, checked) => updateEvent(id, { major: checked }),
    onDelete: (id) => {
      store.set((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }));
    },
    onMove: (id, dir) => {
      store.set((s) => {
        const idx = s.events.findIndex((e) => e.id === id);
        if (idx < 0) return s;
        const target = idx + dir;
        if (target < 0 || target >= s.events.length) return s;
        const next = s.events.slice();
        [next[idx], next[target]] = [next[target], next[idx]];
        return { ...s, events: next };
      });
    },
  });

  function updateEvent(id: string, patch: Partial<EventEntry>): void {
    store.set((s) => ({
      ...s,
      events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }

  function parseYearLoose(raw: string): number {
    const n = Math.round(Number(raw));
    return Number.isFinite(n) ? n : CURRENT_YEAR;
  }

  // ---- wiring: birth / end year ---------------------------------------------
  birthYearInput.addEventListener('input', () => {
    const raw = birthYearInput.value.trim();
    const year = raw === '' ? null : Math.round(Number(raw));
    store.set((s) => {
      const next: PosterData = { ...s, birthYear: Number.isFinite(year as number) ? year : null };
      if (!s.subtitle && next.birthYear !== null) {
        next.subtitle = `${next.birthYear} – ${next.endYear}`;
      }
      return next;
    });
  });

  endYearInput.addEventListener('input', () => {
    const raw = endYearInput.value.trim();
    const year = raw === '' ? CURRENT_YEAR : Math.round(Number(raw));
    store.set((s) => {
      const next: PosterData = { ...s, endYear: Number.isFinite(year) ? year : CURRENT_YEAR };
      if (s.subtitle === `${s.birthYear} – ${s.endYear}` && s.birthYear !== null) {
        next.subtitle = `${s.birthYear} – ${next.endYear}`;
      }
      return next;
    });
  });

  titleInput.addEventListener('input', () => store.set({ title: titleInput.value }));
  subtitleInput.addEventListener('input', () => store.set({ subtitle: subtitleInput.value }));

  // ---- wood tone --------------------------------------------------------------
  toneGroup.querySelectorAll<HTMLButtonElement>('.tone-swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tone = btn.dataset.tone as WoodTone;
      store.set({ woodTone: tone });
    });
  });

  function syncToneButtons(tone: WoodTone) {
    toneGroup.querySelectorAll<HTMLButtonElement>('.tone-swatch').forEach((btn) => {
      const active = btn.dataset.tone === tone;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  // ---- add event ----------------------------------------------------------
  addEventBtn.addEventListener('click', () => {
    const newId = makeId();
    store.set((s) => ({
      ...s,
      events: [...s.events, { id: newId, year: s.birthYear ?? CURRENT_YEAR, label: '', major: false }],
    }));
    // store.set() runs subscribers (incl. eventList.render) synchronously, so
    // the new row already exists in the DOM here — no rAF/race needed.
    eventsContainer
      .querySelector<HTMLInputElement>(`.event-row[data-id="${newId}"] .event-row__label`)
      ?.focus();
  });

  // ---- preview render (rAF-coalesced) --------------------------------------
  let rafId: number | null = null;
  let saveTimer: number | null = null;

  function scheduleRender() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      renderPreview();
    });
  }

  function renderPreview() {
    const data = store.get();
    const rings = buildRingModel(data);
    const result = renderPosterSVG(data, rings);
    posterMount.innerHTML = result.svg;
    posterMount.classList.toggle('poster-frame--empty', data.birthYear === null);
  }

  store.subscribe((state) => {
    eventList.render(state.events);
    syncToneButtons(state.woodTone);
    eventCountHint.textContent =
      state.events.length > 30
        ? `${state.events.length} 件の出来事（多いとラベルが密集します）`
        : `${state.events.length} 件の出来事`;
    scheduleRender();

    if (saveTimer !== null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => savePosterData(state), 250);
  });

  // initial paint
  eventList.render(initial.events);
  syncToneButtons(initial.woodTone);
  eventCountHint.textContent = `${initial.events.length} 件の出来事`;
  renderPreview();

  // ---- export ---------------------------------------------------------------
  function setStatus(kind: 'idle' | 'loading' | 'success' | 'error', message: string) {
    statusLine.className = `status-line status--${kind}`;
    statusLine.textContent = message;
  }

  async function withExportGuard(btn: HTMLButtonElement, label: string, fn: () => Promise<string>) {
    const data = store.get();
    if (data.birthYear === null) {
      setStatus('error', '書き出す前に生まれた年を入力してください。');
      return;
    }
    const buttons = [btnExportSvg, btnExportPngScreen, btnExportPngPrint];
    buttons.forEach((b) => (b.disabled = true));
    btn.classList.add('is-loading');
    setStatus('loading', `${label}を生成しています…`);
    try {
      const filename = await fn();
      setStatus('success', `書き出し完了: ${filename}`);
    } catch (err) {
      console.error(err);
      setStatus('error', `${label}の書き出しに失敗しました。もう一度お試しください。`);
    } finally {
      btn.classList.remove('is-loading');
      buttons.forEach((b) => (b.disabled = false));
    }
  }

  btnExportSvg.addEventListener('click', () =>
    withExportGuard(btnExportSvg, 'SVG', async () => {
      const data = store.get();
      const rings = buildRingModel(data);
      const { svg } = renderPosterSVG(data, rings);
      const standalone = await buildStandaloneSvg(svg, true);
      const filename = makeFilename(data.title, 'svg');
      downloadSvgFile(standalone, filename);
      return filename;
    }),
  );

  btnExportPngScreen.addEventListener('click', () =>
    withExportGuard(btnExportPngScreen, 'PNG（画面用）', async () => {
      const data = store.get();
      const rings = buildRingModel(data);
      const { svg } = renderPosterSVG(data, rings);
      const standalone = await buildStandaloneSvg(svg, true);
      const blob = await rasterizeToPng(standalone, 1600);
      const filename = makeFilename(data.title, 'png').replace(/\.png$/, '-screen.png');
      triggerDownload(blob, filename);
      return filename;
    }),
  );

  btnExportPngPrint.addEventListener('click', () =>
    withExportGuard(btnExportPngPrint, 'PNG（印刷用 高解像度）', async () => {
      const data = store.get();
      const rings = buildRingModel(data);
      const { svg } = renderPosterSVG(data, rings);
      const standalone = await buildStandaloneSvg(svg, true);
      const blob = await rasterizeToPng(standalone, 4200);
      const filename = makeFilename(data.title, 'png').replace(/\.png$/, '-print.png');
      triggerDownload(blob, filename);
      return filename;
    }),
  );

  setStatus('idle', '入力内容はこの端末に自動保存されます。');
}

function toneSwatchMarkup(tone: WoodTone): string {
  const p = WOOD_PALETTES[tone];
  return `<button type="button" class="tone-swatch" data-tone="${tone}" aria-pressed="false">
    <span class="tone-swatch__chip" style="background:linear-gradient(135deg, ${p.ringLow}, ${p.ringHigh} 55%, ${p.bark})"></span>
    <span class="tone-swatch__label">${p.label}</span>
  </button>`;
}

function buildShellMarkup(): string {
  return `
  <div class="app-shell">
    <header class="app-header">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">年輪</span>
        <div class="brand-text">
          <h1 class="brand-title">Life&nbsp;Rings</h1>
          <p class="brand-tagline">生まれた年から、あなただけの年輪を育てる</p>
        </div>
      </div>
      <p class="brand-note">ブラウザ内だけで完結・データはこの端末にのみ保存されます</p>
    </header>

    <main class="workspace">
      <section class="form-panel" aria-label="ポスターの設定">
        <div class="form-section">
          <h2 class="form-section__title"><span class="rule" aria-hidden="true"></span>起点となる年</h2>
          <div class="field-row">
            <div class="field">
              <label for="field-birth-year">生まれた年</label>
              <input id="field-birth-year" type="number" inputmode="numeric" placeholder="例: 1992" min="1" max="2200" />
            </div>
            <div class="field">
              <label for="field-end-year">終了年</label>
              <input id="field-end-year" type="number" inputmode="numeric" min="1" max="2200" />
            </div>
          </div>
          <p class="field-hint">生まれた年をピス（芯）として、終了年まで1年ごとに輪が育ちます。</p>
        </div>

        <div class="form-section">
          <h2 class="form-section__title"><span class="rule" aria-hidden="true"></span>タイトル</h2>
          <div class="field">
            <label for="field-title">タイトル</label>
            <input id="field-title" type="text" maxlength="80" placeholder="例: 田中太郎の人生" />
          </div>
          <div class="field">
            <label for="field-subtitle">サブタイトル</label>
            <input id="field-subtitle" type="text" maxlength="120" placeholder="例: 1992 – 2026" />
          </div>
        </div>

        <div class="form-section">
          <h2 class="form-section__title"><span class="rule" aria-hidden="true"></span>木のトーン</h2>
          <div id="tone-group" class="tone-group" role="group" aria-label="木のトーンを選択">
            ${toneSwatchMarkup('oak')}
            ${toneSwatchMarkup('walnut')}
            ${toneSwatchMarkup('ash')}
          </div>
        </div>

        <div class="form-section form-section--grow">
          <div class="form-section__header">
            <h2 class="form-section__title"><span class="rule" aria-hidden="true"></span>出来事</h2>
            <span id="event-count-hint" class="event-count-hint">0 件の出来事</span>
          </div>
          <p class="field-hint">「大きな出来事」にすると、その年の輪に節・割れ目・色の濃淡があらわれます。</p>
          <div id="events-container" class="events-container"></div>
          <button id="btn-add-event" type="button" class="btn btn--ghost btn--block">+ 出来事を追加</button>
        </div>
      </section>

      <section class="preview-panel" aria-label="ポスターのプレビュー">
        <div class="preview-stage">
          <div id="poster-mount" class="poster-frame"></div>
        </div>
        <div class="preview-footer">
          <div class="export-actions">
            <button id="btn-export-svg" type="button" class="btn btn--outline">SVGを保存</button>
            <button id="btn-export-png-screen" type="button" class="btn btn--outline">PNG（画面用）</button>
            <button id="btn-export-png-print" type="button" class="btn btn--primary">PNG（印刷用 高解像度）</button>
          </div>
          <div id="status-line" class="status-line status--idle" role="status" aria-live="polite"></div>
        </div>
      </section>
    </main>
  </div>`;
}
