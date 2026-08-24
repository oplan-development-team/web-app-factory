import "./style.css";
import { BACKGROUND_PRESETS, RIBBON_HUES } from "./palette";
import { RibbonEngine } from "./ribbon";
import { exportPoster } from "./export";

function requireElement<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return el;
}

const canvas = requireElement<HTMLCanvasElement>("#ribbon-canvas");
const backgroundSwatchRow = requireElement<HTMLDivElement>("#background-swatches");
const ribbonSwatchRow = requireElement<HTMLDivElement>("#ribbon-swatches");
const captionInput = requireElement<HTMLInputElement>("#caption-input");
const captionPreview = requireElement<HTMLDivElement>("#caption-preview");
const undoButton = requireElement<HTMLButtonElement>("#undo-btn");
const clearButton = requireElement<HTMLButtonElement>("#clear-btn");
const downloadButton = requireElement<HTMLButtonElement>("#download-btn");
const stageHint = requireElement<HTMLParagraphElement>("#stage-hint");

const engine = new RibbonEngine(canvas, BACKGROUND_PRESETS[0].hex, RIBBON_HUES[0].hex);

function buildSwatches(
  container: HTMLDivElement,
  items: { id: string; label: string; hex: string }[],
  onSelect: (hex: string, id: string) => void
): void {
  items.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "swatch";
    button.style.setProperty("--swatch-color", item.hex);
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", index === 0 ? "true" : "false");
    button.setAttribute("aria-label", item.label);
    button.title = item.label;
    button.dataset.id = item.id;

    button.addEventListener("click", () => {
      container.querySelectorAll(".swatch").forEach((el) => el.setAttribute("aria-checked", "false"));
      button.setAttribute("aria-checked", "true");
      onSelect(item.hex, item.id);
    });

    container.appendChild(button);
  });
}

buildSwatches(backgroundSwatchRow, BACKGROUND_PRESETS, (hex) => {
  engine.setBackground(hex);
});

buildSwatches(ribbonSwatchRow, RIBBON_HUES, (hex) => {
  engine.setRibbonHue(hex);
});

captionInput.addEventListener("input", () => {
  captionPreview.textContent = captionInput.value.trim();
});

undoButton.addEventListener("click", () => {
  engine.undo();
  updateHintVisibility();
});

clearButton.addEventListener("click", () => {
  engine.clear();
  updateHintVisibility();
});

let isExporting = false;
downloadButton.addEventListener("click", async () => {
  if (isExporting) {
    return;
  }
  isExporting = true;
  const originalLabel = downloadButton.textContent;
  downloadButton.textContent = "Rendering…";
  downloadButton.disabled = true;
  try {
    const snapshot = engine.getSnapshot();
    await exportPoster({
      backgroundHex: snapshot.backgroundHex,
      strokes: snapshot.strokes,
      captionText: captionInput.value,
    });
  } catch (error) {
    console.error("Failed to export poster", error);
  } finally {
    downloadButton.textContent = originalLabel;
    downloadButton.disabled = false;
    isExporting = false;
  }
});

function updateHintVisibility(): void {
  stageHint.style.opacity = engine.getStrokeCount() > 0 ? "0" : "1";
}

canvas.addEventListener("pointerdown", () => {
  stageHint.style.opacity = "0";
});

canvas.addEventListener("pointerup", updateHintVisibility);
canvas.addEventListener("pointercancel", updateHintVisibility);
