import "./style.css";
import {
  type KamonStructure,
  type Palette,
  PALETTES,
  buildKamonStructure,
  describeStructure,
  filenameFromSeed,
  placeholderSVG,
  renderKamonSVG,
} from "./lib/kamon";

interface HistoryEntry {
  plateNo: number;
  nameValue: string;
  birthdayValue: string;
  seedText: string;
  variantIndex: number;
  structure: KamonStructure;
}

const els = {
  nameInput: document.getElementById("input-name") as HTMLInputElement,
  birthdayInput: document.getElementById("input-birthday") as HTMLInputElement,
  paletteSwatches: document.getElementById("palette-swatches") as HTMLDivElement,
  nextPatternBtn: document.getElementById("next-pattern-btn") as HTMLButtonElement,
  historyCount: document.getElementById("history-count") as HTMLSpanElement,
  historyEmpty: document.getElementById("history-empty") as HTMLParagraphElement,
  historyList: document.getElementById("history-list") as HTMLOListElement,
  crestMount: document.getElementById("crest-mount") as HTMLDivElement,
  crestPlaceholderText: document.getElementById("crest-placeholder-text") as HTMLParagraphElement,
  crestCaption: document.getElementById("crest-caption") as HTMLDivElement,
  crestPlateLabel: document.getElementById("crest-plate-label") as HTMLParagraphElement,
  crestDesc: document.getElementById("crest-desc") as HTMLParagraphElement,
  crestSeedEcho: document.getElementById("crest-seed-echo") as HTMLParagraphElement,
  downloadBtn: document.getElementById("download-btn") as HTMLButtonElement,
  downloadStatus: document.getElementById("download-status") as HTMLParagraphElement,
  errorBanner: document.getElementById("error-banner") as HTMLParagraphElement,
};

const state: {
  history: HistoryEntry[];
  currentEntry: HistoryEntry | null;
  paletteId: Palette["id"];
  plateSeq: number;
} = {
  history: [],
  currentEntry: null,
  paletteId: "sumi",
  plateSeq: 0,
};

function currentPalette(): Palette {
  return PALETTES.find((p) => p.id === state.paletteId) ?? PALETTES[0]!;
}

function combinedSeedText(): string {
  const name = els.nameInput.value.trim();
  const birthday = els.birthdayInput.value.trim();
  return [name, birthday].filter(Boolean).join(" / ");
}

function showError(message: string | null): void {
  if (!message) {
    els.errorBanner.hidden = true;
    els.errorBanner.textContent = "";
    return;
  }
  els.errorBanner.hidden = false;
  els.errorBanner.textContent = message;
}

/* ---------- 配色（色目）スウォッチ ---------- */

function renderPaletteSwatches(): void {
  els.paletteSwatches.innerHTML = "";
  for (const palette of PALETTES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "palette-swatch";
    btn.setAttribute("aria-pressed", String(palette.id === state.paletteId));
    btn.innerHTML = `
      <span class="palette-swatch-chip" style="background:${palette.paper};border-color:${palette.ink};"></span>
      <span class="palette-swatch-label">${palette.label}</span>
    `;
    btn.addEventListener("click", () => {
      state.paletteId = palette.id;
      renderPaletteSwatches();
      rerenderAllForPaletteChange();
    });
    els.paletteSwatches.appendChild(btn);
  }
}

function rerenderAllForPaletteChange(): void {
  const palette = currentPalette();
  if (state.currentEntry) {
    try {
      els.crestMount.innerHTML = renderKamonSVG(state.currentEntry.structure, palette);
    } catch {
      showError("配色の適用中に問題が発生しました。別の配色をお試しください。");
    }
  }
  for (const item of Array.from(els.historyList.children)) {
    const plateNo = Number(item.getAttribute("data-plate-no"));
    const entry = state.history.find((h) => h.plateNo === plateNo);
    const thumb = item.querySelector(".history-thumb");
    if (entry && thumb) {
      try {
        thumb.innerHTML = renderKamonSVG(entry.structure, palette);
      } catch {
        /* サムネイル再描画の失敗は致命的ではないため無視 */
      }
    }
  }
}

/* ---------- 家紋の表示 ---------- */

function displayEntry(entry: HistoryEntry, opts: { animate?: boolean } = {}): void {
  state.currentEntry = entry;
  const palette = currentPalette();

  try {
    const svg = renderKamonSVG(entry.structure, palette);
    els.crestMount.classList.remove("is-empty");
    els.crestMount.innerHTML = svg;
    if (opts.animate !== false) {
      els.crestMount.classList.remove("is-updating");
      // reflow to restart animation
      void els.crestMount.offsetWidth;
      els.crestMount.classList.add("is-updating");
    }
    showError(null);
  } catch {
    showError("紋様の生成中に問題が発生しました。入力を少し変えてお試しください。");
    return;
  }

  els.crestPlaceholderText.hidden = true;
  els.crestCaption.hidden = false;
  els.crestPlateLabel.textContent = `図版 ${String(entry.plateNo).padStart(2, "0")}`;
  els.crestDesc.textContent = describeStructure(entry.structure);
  els.crestSeedEcho.textContent = `seed: “${entry.seedText}” · variant ${entry.variantIndex + 1}`;

  els.downloadBtn.disabled = false;
  els.nextPatternBtn.disabled = false;

  markCurrentInHistoryList(entry.plateNo);
}

function showEmptyCrestState(): void {
  state.currentEntry = null;
  els.crestMount.classList.add("is-empty");
  els.crestMount.innerHTML = placeholderSVG();
  els.crestPlaceholderText.hidden = false;
  els.crestCaption.hidden = true;
  els.downloadBtn.disabled = true;
  els.nextPatternBtn.disabled = true;
  markCurrentInHistoryList(null);
}

/* ---------- 図版帖（履歴） ---------- */

function markCurrentInHistoryList(plateNo: number | null): void {
  for (const item of Array.from(els.historyList.children)) {
    const isCurrent = item.getAttribute("data-plate-no") === String(plateNo);
    item.setAttribute("aria-current", String(isCurrent));
  }
}

function appendHistoryEntry(entry: HistoryEntry): void {
  state.history.push(entry);
  els.historyEmpty.hidden = true;
  els.historyList.hidden = false;
  els.historyCount.textContent = `（${state.history.length}）`;

  const li = document.createElement("li");
  li.className = "history-item";
  li.setAttribute("data-plate-no", String(entry.plateNo));
  li.setAttribute("role", "button");
  li.setAttribute("tabindex", "0");
  li.setAttribute("aria-current", "false");

  const thumb = document.createElement("span");
  thumb.className = "history-thumb";
  thumb.innerHTML = renderKamonSVG(entry.structure, currentPalette());

  const plateNoEl = document.createElement("span");
  plateNoEl.className = "history-plate-no";
  plateNoEl.textContent = String(entry.plateNo).padStart(2, "0");

  const desc = document.createElement("span");
  desc.className = "history-desc";
  desc.textContent = `${entry.seedText || "無銘"}${entry.variantIndex > 0 ? `（其の${entry.variantIndex + 1}）` : ""}`;

  li.append(plateNoEl, thumb, desc);
  const selectFromHistory = () => {
    els.nameInput.value = entry.nameValue;
    els.birthdayInput.value = entry.birthdayValue;
    lastCommittedSeed = entry.seedText;
    variantSeqForSeed = entry.variantIndex;
    displayEntry(entry);
  };
  li.addEventListener("click", selectFromHistory);
  li.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectFromHistory();
    }
  });

  els.historyList.prepend(li);
}

/* ---------- 生成フロー ---------- */

let lastCommittedSeed = "";
let variantSeqForSeed = 0;
let debounceHandle: number | undefined;

function commitSeedChange(): void {
  const seedText = combinedSeedText();

  if (!seedText) {
    lastCommittedSeed = "";
    showEmptyCrestState();
    return;
  }

  if (seedText === lastCommittedSeed && state.currentEntry) {
    // 実質変化なし
    return;
  }

  lastCommittedSeed = seedText;
  variantSeqForSeed = 0;
  generateAndShow(seedText, 0);
}

function generateAndShow(seedText: string, variantIndex: number): void {
  try {
    const structure = buildKamonStructure(seedText, variantIndex);
    state.plateSeq += 1;
    const entry: HistoryEntry = {
      plateNo: state.plateSeq,
      nameValue: els.nameInput.value,
      birthdayValue: els.birthdayInput.value,
      seedText,
      variantIndex,
      structure,
    };
    appendHistoryEntry(entry);
    displayEntry(entry);
  } catch {
    showError("紋様の生成中に問題が発生しました。入力を少し変えてお試しください。");
  }
}

function onSeedInput(): void {
  window.clearTimeout(debounceHandle);
  debounceHandle = window.setTimeout(commitSeedChange, 250);
}

els.nameInput.addEventListener("input", onSeedInput);
els.birthdayInput.addEventListener("input", onSeedInput);

els.nextPatternBtn.addEventListener("click", () => {
  if (!lastCommittedSeed) return;
  variantSeqForSeed += 1;
  generateAndShow(lastCommittedSeed, variantSeqForSeed);
});

/* ---------- SVGダウンロード ---------- */

els.downloadBtn.addEventListener("click", () => {
  const entry = state.currentEntry;
  if (!entry) return;

  try {
    const svgMarkup = renderKamonSVG(entry.structure, currentPalette());
    const fullSvg = `<?xml version="1.0" encoding="UTF-8"?>\n${svgMarkup}`;
    const blob = new Blob([fullSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filenameFromSeed(entry.seedText, entry.variantIndex);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);

    els.downloadStatus.textContent = "SVGとして書き出しました。";
    els.downloadBtn.classList.remove("is-stamped");
    void els.downloadBtn.offsetWidth;
    els.downloadBtn.classList.add("is-stamped");
    window.setTimeout(() => {
      els.downloadStatus.textContent = "";
    }, 3200);
  } catch {
    els.downloadStatus.textContent = "";
    showError("書き出し中に問題が発生しました。もう一度お試しください。");
  }
});

/* ---------- 初期化 ---------- */

renderPaletteSwatches();
showEmptyCrestState();
