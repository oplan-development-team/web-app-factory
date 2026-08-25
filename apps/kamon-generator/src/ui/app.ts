/**
 * 画面の配線（SPEC 3.1 / 3.3 / 3.4 / 3.5 / 3.6）。
 *
 * 生成そのものは同期で 1ms 前後で終わる。時間がかかっているように見せるのが
 * 目的ではなく、「割り出している」という所作を見せるために表示だけを段どりする。
 * そのため図版帖への記録は要求した瞬間に確定させ、右ページの差し替えだけを
 * 最新要求優先で間引く（FR-501.1）。連打しても記録は落ちない。
 */

import { buildKamonStructure, type KamonStructure } from "../lib/kamon";
import {
  buildFilename,
  downloadBlob,
  svgBlob,
  svgToPngBlob,
} from "../lib/exportImage";
import { DEFAULT_PALETTE_ID, PALETTES, paletteById, type Palette } from "../lib/palette";
import { renderKamonSVG, toStandaloneSVG } from "../lib/render";
import {
  appendPlate,
  clearPlates,
  findPlate,
  loadPlates,
  resolveStore,
  savePlates,
  type KeyValueStore,
  type PlateRecord,
} from "../lib/storage";
import { createCrestStage, type CrestStage } from "./crestStage";
import { requireElement, setText } from "./dom";
import { createPlateBook, plateKey, type PlateBook } from "./plateBook";
import { createStatusRegion, type StatusRegion } from "./status";

/** 入力が落ち着いたとみなすまでの時間（FR-001.4） */
export const INPUT_DEBOUNCE_MS = 200;

const MAX_SEED_PART = 40;

/** シードは名前と誕生日を「 / 」で連ねる（FR-001.1〜3） */
export function buildSeedText(name: string, birthday: string): string {
  return [name, birthday]
    .map((part) => part.trim().slice(0, MAX_SEED_PART))
    .filter((part) => part.length > 0)
    .join(" / ");
}

interface Refs {
  name: HTMLInputElement;
  birthday: HTMLInputElement;
  swatches: HTMLElement;
  nextButton: HTMLButtonElement;
  retryButton: HTMLButtonElement;
  exportSvg: HTMLButtonElement;
  exportPng: HTMLButtonElement;
  clearButton: HTMLButtonElement;
  clearConfirm: HTMLElement;
  clearYes: HTMLButtonElement;
  clearNo: HTMLButtonElement;
}

function collectRefs(root: ParentNode): Refs {
  return {
    name: requireElement(root, "#input-name", HTMLInputElement),
    birthday: requireElement(root, "#input-birthday", HTMLInputElement),
    swatches: requireElement(root, "#palette-swatches", HTMLDivElement),
    nextButton: requireElement(root, "#next-crest-btn", HTMLButtonElement),
    retryButton: requireElement(root, "#retry-btn", HTMLButtonElement),
    exportSvg: requireElement(root, "#export-svg-btn", HTMLButtonElement),
    exportPng: requireElement(root, "#export-png-btn", HTMLButtonElement),
    clearButton: requireElement(root, "#clear-book-btn", HTMLButtonElement),
    clearConfirm: requireElement(root, "#clear-book-confirm", HTMLDivElement),
    clearYes: requireElement(root, "#clear-book-yes", HTMLButtonElement),
    clearNo: requireElement(root, "#clear-book-no", HTMLButtonElement),
  };
}

function buildStage(root: ParentNode): CrestStage {
  return createCrestStage({
    stage: requireElement(root, "#crest-stage", HTMLDivElement),
    mount: requireElement(root, "#crest-mount", HTMLDivElement),
    caption: requireElement(root, "#crest-caption", HTMLDivElement),
    name: requireElement(root, "#crest-name", HTMLHeadingElement),
    spec: requireElement(root, "#crest-spec", HTMLParagraphElement),
    seed: requireElement(root, "#crest-seed", HTMLParagraphElement),
    error: requireElement(root, "#stage-error", HTMLParagraphElement),
  });
}

/** localStorage は参照そのものが例外になる環境があるため、触る前から守る */
function detectStore(): KeyValueStore | null {
  try {
    return resolveStore(window.localStorage);
  } catch {
    return null;
  }
}

export interface AppHandle {
  destroy(): void;
}

export function createApp(root: ParentNode = document): AppHandle {
  const refs = collectRefs(root);
  const stage = buildStage(root);
  const status: StatusRegion = createStatusRegion(
    requireElement(root, "#status-region", HTMLParagraphElement),
  );

  const store = detectStore();
  let plates: PlateRecord[] = loadPlates(store);
  let nextPlateNo = plates.reduce((max, p) => Math.max(max, p.plateNo), 0) + 1;
  let palette: Palette = paletteById(DEFAULT_PALETTE_ID);
  let variantIndex = 0;
  let seedText = "";
  let requestToken = 0;
  let debounceTimer: number | undefined;
  let storageWarned = false;

  const plateBook: PlateBook = createPlateBook(
    {
      list: requireElement(root, "#plate-list", HTMLOListElement),
      empty: requireElement(root, "#plate-book-empty", HTMLElement),
      count: requireElement(root, "#plate-book-count", HTMLElement),
      clearButton: refs.clearButton,
      confirm: refs.clearConfirm,
    },
    { onSelect: (plate) => openPlate(plate) },
  );

  /* ---------------- 保存 ---------------- */

  function persist(): void {
    if (store === null) {
      warnMemoryOnly();
      return;
    }
    if (!savePlates(store, plates)) warnMemoryOnly();
  }

  /** 保存できない環境でも動きは止めず、降格したことを 1 度だけ伝える（FR-301.4） */
  function warnMemoryOnly(): void {
    if (storageWarned) return;
    storageWarned = true;
    status.announce(
      "この環境では図版帖を保存できないため、閉じるまでの一時的な記録になります。",
      "error",
    );
  }

  /* ---------------- 表示の更新 ---------------- */

  function currentKey(): string | null {
    const view = stage.view();
    return view === null
      ? null
      : plateKey(view.structure.seedText, view.structure.variantIndex);
  }

  function refreshPlateBook(): void {
    plateBook.render(plates, palette, currentKey());
  }

  function refreshControls(): void {
    const ready = stage.state() === "ready";
    refs.nextButton.disabled = seedText.length === 0;
    refs.exportSvg.disabled = !ready;
    refs.exportPng.disabled = !ready;
  }

  /** 同一シード・同一バリアントは積み増さず、既存の図版を選び直す（FR-300.2） */
  function recordPlate(): PlateRecord {
    const existing = findPlate(plates, seedText, variantIndex);
    if (existing) return existing;

    const plate: PlateRecord = {
      plateNo: nextPlateNo,
      name: refs.name.value.trim(),
      birthday: refs.birthday.value.trim(),
      seedText,
      variantIndex,
      savedAt: Date.now(),
    };
    nextPlateNo += 1;
    plates = appendPlate(plates, plate);
    persist();
    return plate;
  }

  function tryBuild(seed: string, variant: number): KamonStructure | null {
    try {
      return buildKamonStructure(seed, variant);
    } catch {
      return null;
    }
  }

  async function generate(): Promise<void> {
    const token = (requestToken += 1);

    if (seedText.length === 0) {
      stage.showEmpty();
      refreshControls();
      refreshPlateBook();
      return;
    }

    // 記録は要求した瞬間に確定させる。表示だけを間引くので連打しても落ちない
    const plate = recordPlate();
    const structure = tryBuild(seedText, variantIndex);
    if (structure === null) {
      stage.showError("この種からは紋を割り出せませんでした。入力を変えてお試しください。");
      refreshControls();
      return;
    }
    refreshPlateBook();

    await stage.beginDraft();
    if (token !== requestToken) return;

    stage.present({ structure, palette, plateNo: plate.plateNo });
    refreshControls();
    refreshPlateBook();
  }

  /** 図版帖から選び直したときは割り出しを見せない（新たに割り出したのではないため） */
  function openPlate(plate: PlateRecord): void {
    window.clearTimeout(debounceTimer);
    requestToken += 1;

    refs.name.value = plate.name;
    refs.birthday.value = plate.birthday;
    seedText = plate.seedText;
    variantIndex = plate.variantIndex;

    const structure = tryBuild(plate.seedText, plate.variantIndex);
    if (structure === null) {
      stage.showError("この図版は復元できませんでした。");
    } else {
      stage.present({ structure, palette, plateNo: plate.plateNo });
    }
    refreshControls();
    refreshPlateBook();
  }

  /* ---------------- 入力 ---------------- */

  function onInput(): void {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      const next = buildSeedText(refs.name.value, refs.birthday.value);
      if (next === seedText) return;
      seedText = next;
      variantIndex = 0;
      void generate();
    }, INPUT_DEBOUNCE_MS);
  }

  function onNext(): void {
    if (seedText.length === 0) return;
    variantIndex += 1;
    void generate();
  }

  /* ---------------- 色目 ---------------- */

  function buildSwatches(): void {
    refs.swatches.replaceChildren();
    for (const preset of PALETTES) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "palette-swatch";
      button.dataset["paletteId"] = preset.id;
      button.setAttribute("aria-pressed", String(preset.id === palette.id));

      const chip = document.createElement("span");
      chip.className = "palette-swatch-chip";
      chip.style.background = preset.paper;
      chip.style.color = preset.ink;

      const label = document.createElement("span");
      label.className = "palette-swatch-label";
      setText(label, preset.label);

      button.append(chip, label);
      button.addEventListener("click", () => selectPalette(preset));
      refs.swatches.append(button);
    }
  }

  function selectPalette(next: Palette): void {
    palette = next;
    for (const button of refs.swatches.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset["paletteId"] === next.id));
    }
    stage.recolor(next);
    refreshPlateBook();
  }

  /* ---------------- 書き出し ---------------- */

  async function exportCrest(format: "svg" | "png"): Promise<void> {
    const view = stage.view();
    if (view === null) return;

    const { structure } = view;
    const filename = buildFilename(
      structure.name,
      structure.seedText,
      structure.variantIndex,
      format,
    );
    const markup = toStandaloneSVG(renderKamonSVG(structure, palette));

    try {
      if (format === "svg") {
        downloadBlob(svgBlob(markup), filename);
      } else {
        status.announce("PNG を書き出しています…", "info");
        downloadBlob(await svgToPngBlob(markup, palette.paper), filename);
      }
      status.announce(`${filename} を書き出しました。`, "success");
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : "原因不明のエラー";
      status.announce(`書き出しに失敗しました（${reason}）。`, "error");
    }
  }

  /* ---------------- 帳を空にする ---------------- */

  function askClear(): void {
    refs.clearButton.hidden = true;
    refs.clearConfirm.hidden = false;
    refs.clearYes.focus();
  }

  function cancelClear(): void {
    plateBook.resetConfirm();
    refs.clearButton.focus();
  }

  function doClear(): void {
    plates = [];
    nextPlateNo = 1;
    clearPlates(store);
    plateBook.resetConfirm();
    stage.showEmpty();
    refs.name.value = "";
    refs.birthday.value = "";
    seedText = "";
    variantIndex = 0;
    requestToken += 1;
    refreshControls();
    refreshPlateBook();
    status.announce("図版帖を空にしました。", "success");
  }

  /* ---------------- 起動 ---------------- */

  buildSwatches();
  stage.showEmpty();
  refreshControls();
  refreshPlateBook();

  const listeners: Array<() => void> = [];
  const on = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
  ): void => {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  };

  on(refs.name, "input", onInput);
  on(refs.birthday, "input", onInput);
  on(refs.nextButton, "click", onNext);
  on(refs.retryButton, "click", () => void generate());
  on(refs.exportSvg, "click", () => void exportCrest("svg"));
  on(refs.exportPng, "click", () => void exportCrest("png"));
  on(refs.clearButton, "click", askClear);
  on(refs.clearYes, "click", doClear);
  on(refs.clearNo, "click", cancelClear);

  return {
    destroy() {
      window.clearTimeout(debounceTimer);
      for (const off of listeners) off();
    },
  };
}
