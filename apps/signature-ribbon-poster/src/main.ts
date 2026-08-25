import { DraftSync } from "./app/draft-sync";
import { downloadResult, loadCaptionFonts, renderPoster } from "./app/exporter";
import { PointerInput } from "./app/pointer-input";
import { Studio, type StudioChange, type StudioState } from "./app/studio";
import { ResolutionPicker } from "./app/ui/resolution-picker";
import { ResponseSlider } from "./app/ui/response-slider";
import { RestoreBanner } from "./app/ui/restore-banner";
import { SwatchGroup } from "./app/ui/swatches";
import { Toaster } from "./app/ui/toast";
import { DraftStorage } from "./core/draft-storage";
import {
  BACKGROUND_PRESETS,
  RIBBON_HUES,
  type BackgroundId,
  type RibbonHueId,
} from "./core/palette";
import { LiveRenderer } from "./render/live-renderer";
import { domCanvasFactory } from "./render/types";

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

const canvas = requireElement<HTMLCanvasElement>("#ribbon-canvas");
const posterFrame = requireElement<HTMLDivElement>("#poster-frame");
const captionInput = requireElement<HTMLInputElement>("#caption-input");
const captionPreview = requireElement<HTMLParagraphElement>("#caption-preview");
const stageHint = requireElement<HTMLParagraphElement>("#stage-hint");
const undoButton = requireElement<HTMLButtonElement>("#undo-btn");
const redoButton = requireElement<HTMLButtonElement>("#redo-btn");
const clearButton = requireElement<HTMLButtonElement>("#clear-btn");
const downloadButton = requireElement<HTMLButtonElement>("#download-btn");
const downloadLabel = requireElement<HTMLSpanElement>("#download-label");

const studio = new Studio();
const toaster = new Toaster(requireElement<HTMLDivElement>("#toast-host"));
const draftStorage = new DraftStorage();
let isExporting = false;

const renderer = new LiveRenderer({
  display: canvas,
  createCanvas: domCanvasFactory,
  backgroundHex: studio.backgroundHex,
  maxSpeed: studio.maxSpeed,
  cssWidth: posterFrame.clientWidth,
  pixelRatio: window.devicePixelRatio || 1,
});

new PointerInput(canvas, studio);

const backgroundSwatches = new SwatchGroup<BackgroundId>({
  container: requireElement<HTMLDivElement>("#background-swatches"),
  presets: BACKGROUND_PRESETS,
  selected: studio.state.backgroundId,
  onSelect: (id) => studio.setBackground(id),
});

const hueSwatches = new SwatchGroup<RibbonHueId>({
  container: requireElement<HTMLDivElement>("#ribbon-swatches"),
  presets: RIBBON_HUES,
  selected: studio.state.hueId,
  onSelect: (id) => studio.setHue(id),
});

const responseSlider = new ResponseSlider({
  input: requireElement<HTMLInputElement>("#response-slider"),
  readout: requireElement<HTMLSpanElement>("#response-readout"),
  value: studio.state.response,
  onChange: (value) => studio.setResponse(value),
});

const resolutionPicker = new ResolutionPicker({
  container: requireElement<HTMLDivElement>("#resolution-picker"),
  readout: requireElement<HTMLParagraphElement>("#resolution-readout"),
  selected: studio.state.resolutionId,
  onSelect: (id) => studio.setResolution(id),
});

captionInput.addEventListener("input", () => studio.setCaption(captionInput.value));

undoButton.addEventListener("click", () => studio.undo());
redoButton.addEventListener("click", () => studio.redo());
clearButton.addEventListener("click", () => studio.clear());

/** Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z, unless the user is typing a caption (FR-014). */
window.addEventListener("keydown", (event) => {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") {
    return;
  }
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }
  event.preventDefault();
  if (event.shiftKey) {
    studio.redo();
  } else {
    studio.undo();
  }
});

function applyState(state: StudioState, change: StudioChange): void {
  switch (change) {
    case "background":
      renderer.setBackground(studio.backgroundHex);
      break;
    case "response":
      renderer.setMaxSpeed(studio.maxSpeed);
      break;
    case "stroke-extended":
      renderer.setStrokes(studio.strokes, studio.isDrawing);
      break;
    case "strokes-replaced":
      renderer.setStrokes(studio.strokes, studio.isDrawing);
      renderer.invalidate();
      break;
    case "caption":
      captionPreview.textContent = state.caption.trim();
      break;
    case "hue":
    case "resolution":
      break;
  }

  const hasStrokes = state.strokes.length > 0;
  undoButton.disabled = !state.canUndo;
  redoButton.disabled = !state.canRedo;
  clearButton.disabled = !hasStrokes;
  downloadButton.disabled = !hasStrokes || isExporting;
  stageHint.style.opacity = hasStrokes ? "0" : "1";
}

studio.subscribe(applyState);

new DraftSync({
  studio,
  storage: draftStorage,
  onSaveFailed: () =>
    toaster.error(
      "この環境では下書きを保存できません（ブラウザの設定か保存容量の上限が原因です）。作品は書き出しで保存してください。"
    ),
});

downloadButton.addEventListener("click", async () => {
  if (isExporting) {
    return;
  }
  isExporting = true;
  downloadButton.disabled = true;
  downloadButton.classList.add("is-busy");
  downloadLabel.textContent = "Rendering…";

  try {
    const result = await renderPoster(
      {
        strokes: studio.strokes,
        backgroundHex: studio.backgroundHex,
        maxSpeed: studio.maxSpeed,
        caption: studio.state.caption,
        resolutionId: studio.state.resolutionId,
      },
      { createCanvas: domCanvasFactory, loadFonts: loadCaptionFonts, now: () => new Date() }
    );
    downloadResult(result);
    toaster.success(`ポスターを書き出しました（${result.width} × ${result.height} px）。`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "原因不明のエラーが発生しました";
    toaster.error(`書き出しに失敗しました: ${detail}。解像度を下げてもう一度お試しください。`);
  } finally {
    isExporting = false;
    downloadButton.classList.remove("is-busy");
    downloadLabel.textContent = "Download Poster";
    applyState(studio.state, "strokes-replaced");
  }
});

const resizeObserver = new ResizeObserver(() => {
  renderer.setViewport(posterFrame.clientWidth, window.devicePixelRatio || 1);
});
resizeObserver.observe(posterFrame);

// Offer the previous session's work rather than silently resurrecting it (FR-011.2).
const savedDraft = draftStorage.load();
if (savedDraft && savedDraft.strokes.length > 0) {
  new RestoreBanner({
    host: requireElement<HTMLDivElement>("#banner-host"),
    strokeCount: savedDraft.strokes.length,
    onRestore: () => {
      studio.restore(savedDraft);
      backgroundSwatches.setSelected(savedDraft.backgroundId);
      hueSwatches.setSelected(savedDraft.hueId);
      responseSlider.setValue(savedDraft.response);
      resolutionPicker.setSelected(savedDraft.resolutionId);
      captionInput.value = savedDraft.caption;
      captionPreview.textContent = savedDraft.caption.trim();
      renderer.setBackground(studio.backgroundHex);
      renderer.setMaxSpeed(studio.maxSpeed);
      toaster.success("前回の作品を復元しました。");
    },
    onDiscard: () => {
      draftStorage.clear();
      toaster.success("前回の作品を破棄しました。");
    },
  });
}

applyState(studio.state, "strokes-replaced");
renderer.start();
