import "@fontsource/eb-garamond/400.css";
import "@fontsource/eb-garamond/400-italic.css";
import "@fontsource/eb-garamond/600.css";
import "@fontsource/eb-garamond/600-italic.css";
import "@fontsource/jetbrains-mono/500.css";
import "./style.css";

import { loadImageFile, UploadError } from "./lib/fileHandling.ts";
import { makeSourceCanvas, renderEngraving, type EngravingOptions } from "./lib/engraving.ts";
import { renderPlate, type PlateContent } from "./lib/plateRenderer.ts";
import { buildPlateSVG } from "./lib/svgExport.ts";
import { downloadCanvasAsPng, downloadSvg } from "./lib/download.ts";
import { toRomanNumeral } from "./lib/romanNumeral.ts";
import { IMAGE_BOX, containFit } from "./lib/layout.ts";
import type { ScaleUnit } from "./lib/scaleBar.ts";

function getEl<T extends Element>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`要素が見つかりません: #${id}`);
  return el as unknown as T;
}

const dropzone = getEl<HTMLDivElement>("dropzone");
const fileInput = getEl<HTMLInputElement>("file-input");
const plateCanvas = getEl<HTMLCanvasElement>("plate-canvas");
const processingOverlay = getEl<HTMLDivElement>("processing-overlay");
const uploadError = getEl<HTMLParagraphElement>("upload-error");
const changePhotoBtn = getEl<HTMLButtonElement>("change-photo-btn");
const controlPanel = getEl<HTMLFormElement>("control-panel");

const thresholdSlider = getEl<HTMLInputElement>("threshold-slider");
const thresholdValue = getEl<HTMLOutputElement>("threshold-value");
const densitySlider = getEl<HTMLInputElement>("density-slider");
const densityValue = getEl<HTMLOutputElement>("density-value");
const weightSlider = getEl<HTMLInputElement>("weight-slider");
const weightValue = getEl<HTMLOutputElement>("weight-value");
const invertToggle = getEl<HTMLInputElement>("invert-toggle");
const textureSlider = getEl<HTMLInputElement>("texture-slider");
const textureValue = getEl<HTMLOutputElement>("texture-value");
const plateNumberInput = getEl<HTMLInputElement>("plate-number-input");
const captionInput = getEl<HTMLInputElement>("caption-input");
const scaleValueInput = getEl<HTMLInputElement>("scale-value-input");
const scaleUnitSelect = getEl<HTMLSelectElement>("scale-unit-select");
const exportPngBtn = getEl<HTMLButtonElement>("export-png-btn");
const exportSvgBtn = getEl<HTMLButtonElement>("export-svg-btn");
const exportStatus = getEl<HTMLParagraphElement>("export-status");

const COUNTER_KEY = "specimen-plate-generator:plate-count";

let currentImage: HTMLImageElement | null = null;
let engravingCanvas: HTMLCanvasElement | null = null;

function debounce<Args extends unknown[]>(fn: (...args: Args) => void, wait: number): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function readEngravingOptions(): EngravingOptions {
  return {
    threshold: Number(thresholdSlider.value),
    density: Number(densitySlider.value),
    weight: Number(weightSlider.value),
    invert: invertToggle.checked,
  };
}

function readPlateContent(): PlateContent {
  return {
    plateNumber: plateNumberInput.value,
    caption: captionInput.value,
    scaleValue: Math.max(0.1, Number(scaleValueInput.value) || 1),
    scaleUnit: scaleUnitSelect.value as ScaleUnit,
  };
}

function readTextureIntensity(): number {
  return Number(textureSlider.value);
}

function composite(): void {
  renderPlate(plateCanvas, {
    engravingCanvas,
    textureIntensity: readTextureIntensity(),
    content: readPlateContent(),
  });
}

async function recomputeEngraving(): Promise<void> {
  if (!currentImage) return;
  processingOverlay.hidden = false;
  // オーバーレイの描画をブラウザに反映させてから重い同期処理へ入る
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    const fit = containFit(currentImage.naturalWidth, currentImage.naturalHeight, IMAGE_BOX);
    const sourceCanvas = makeSourceCanvas(currentImage, fit.w, fit.h);
    engravingCanvas = renderEngraving(sourceCanvas, readEngravingOptions());
    composite();
  } catch (err) {
    console.error(err);
    showUploadError("線画の生成に失敗しました。別の画像でお試しください。");
  } finally {
    processingOverlay.hidden = true;
  }
}

const debouncedRecomputeEngraving = debounce(() => {
  void recomputeEngraving();
}, 150);

function showUploadError(message: string): void {
  uploadError.textContent = message;
  uploadError.hidden = false;
}

function clearUploadError(): void {
  uploadError.hidden = true;
  uploadError.textContent = "";
}

function setControlsEnabled(enabled: boolean): void {
  for (const fieldset of controlPanel.querySelectorAll("fieldset")) {
    (fieldset as HTMLFieldSetElement).disabled = !enabled;
  }
}

function nextPlateNumber(): string {
  const stored = Number(localStorage.getItem(COUNTER_KEY) ?? "0");
  const next = Number.isFinite(stored) && stored > 0 ? stored + 1 : 1;
  localStorage.setItem(COUNTER_KEY, String(next));
  return toRomanNumeral(next);
}

async function handleNewImage(file: File): Promise<void> {
  clearUploadError();
  try {
    const image = await loadImageFile(file);
    currentImage = image;
    plateNumberInput.value = nextPlateNumber();

    dropzone.hidden = true;
    plateCanvas.hidden = false;
    changePhotoBtn.hidden = false;
    setControlsEnabled(true);
    exportPngBtn.disabled = false;
    exportSvgBtn.disabled = false;
    exportStatus.textContent = "";

    await recomputeEngraving();
  } catch (err) {
    if (err instanceof UploadError) {
      showUploadError(err.message);
    } else {
      console.error(err);
      showUploadError("画像の読み込み中に問題が発生しました。");
    }
  }
}

// --- アップロードUI ---

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("is-dragover");
});
dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("is-dragover");
});
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("is-dragover");
  const file = e.dataTransfer?.files?.[0];
  if (file) void handleNewImage(file);
});
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void handleNewImage(file);
  fileInput.value = "";
});

changePhotoBtn.addEventListener("click", () => {
  currentImage = null;
  engravingCanvas = null;
  dropzone.hidden = false;
  plateCanvas.hidden = true;
  changePhotoBtn.hidden = true;
  setControlsEnabled(false);
  exportPngBtn.disabled = true;
  exportSvgBtn.disabled = true;
  clearUploadError();
  exportStatus.textContent = "";
});

// --- スライダー／トグル（エングレービングに影響：再計算が必要） ---

function bindSliderReadout(slider: HTMLInputElement, output: HTMLOutputElement): void {
  const update = () => {
    output.textContent = slider.value;
  };
  slider.addEventListener("input", update);
  update();
}

bindSliderReadout(thresholdSlider, thresholdValue);
bindSliderReadout(densitySlider, densityValue);
bindSliderReadout(weightSlider, weightValue);
bindSliderReadout(textureSlider, textureValue);

for (const el of [thresholdSlider, densitySlider, weightSlider]) {
  el.addEventListener("input", debouncedRecomputeEngraving);
}
invertToggle.addEventListener("change", () => void recomputeEngraving());

// --- 紙テクスチャ／ラベル／スケールバー（合成のみで済む＝即時反映） ---

for (const el of [textureSlider, plateNumberInput, captionInput, scaleValueInput, scaleUnitSelect]) {
  el.addEventListener("input", () => {
    if (currentImage) composite();
  });
}

// --- 書き出し ---

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^\w\-]+/g, "_").slice(0, 24) || "plate";
}

exportPngBtn.addEventListener("click", () => {
  void (async () => {
    exportStatus.textContent = "PNGを書き出しています…";
    exportPngBtn.disabled = true;
    try {
      const name = `specimen-plate-${sanitizeFilenamePart(plateNumberInput.value)}.png`;
      await downloadCanvasAsPng(plateCanvas, name);
      exportStatus.textContent = "PNGをダウンロードしました。";
    } catch (err) {
      console.error(err);
      exportStatus.textContent = "PNGの書き出しに失敗しました。もう一度お試しください。";
    } finally {
      exportPngBtn.disabled = false;
    }
  })();
});

exportSvgBtn.addEventListener("click", () => {
  exportStatus.textContent = "SVGを書き出しています…";
  exportSvgBtn.disabled = true;
  try {
    const svg = buildPlateSVG(engravingCanvas, readTextureIntensity(), readPlateContent());
    const name = `specimen-plate-${sanitizeFilenamePart(plateNumberInput.value)}.svg`;
    downloadSvg(svg, name);
    exportStatus.textContent = "SVGをダウンロードしました。";
  } catch (err) {
    console.error(err);
    exportStatus.textContent = "SVGの書き出しに失敗しました。もう一度お試しください。";
  } finally {
    exportSvgBtn.disabled = false;
  }
});
