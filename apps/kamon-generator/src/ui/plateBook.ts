/**
 * 左ページの図版帖（SPEC 3.4）。
 *
 * 保存しているのはシードとバリアント番号だけなので、一覧のサムネイルは
 * その場で構造を組み直して描く。生成器が決定的なので同じ図が必ず戻る。
 * 組み直しは 1 件あたり 1ms 未満だが、色目を変えるたびに 60 件を作り直すのは
 * 無駄なので、構造だけキーで覚えておいて色だけ差し替える。
 */

import { buildKamonStructure, type KamonStructure } from "../lib/kamon";
import { buildKamonSubtitle } from "../lib/naming";
import type { Palette } from "../lib/palette";
import { renderKamonSVG } from "../lib/render";
import type { PlateRecord } from "../lib/storage";
import { setSvg, setText } from "./dom";

export function plateKey(seedText: string, variantIndex: number): string {
  return `${seedText}::${variantIndex}`;
}

export interface PlateBookElements {
  list: HTMLOListElement;
  empty: HTMLElement;
  count: HTMLElement;
  clearButton: HTMLButtonElement;
  confirm: HTMLElement;
}

export interface PlateBookHandlers {
  onSelect(plate: PlateRecord): void;
}

export interface PlateBook {
  render(plates: readonly PlateRecord[], palette: Palette, currentKey: string | null): void;
  /** 確認待ちの表示を畳む */
  resetConfirm(): void;
}

export function createPlateBook(
  elements: PlateBookElements,
  handlers: PlateBookHandlers,
): PlateBook {
  const { list, empty, count, clearButton, confirm } = elements;
  const structures = new Map<string, KamonStructure>();

  const structureFor = (plate: PlateRecord): KamonStructure => {
    const key = plateKey(plate.seedText, plate.variantIndex);
    const cached = structures.get(key);
    if (cached) return cached;
    const built = buildKamonStructure(plate.seedText, plate.variantIndex);
    structures.set(key, built);
    return built;
  };

  const buildItem = (
    plate: PlateRecord,
    palette: Palette,
    isCurrent: boolean,
  ): HTMLLIElement => {
    const structure = structureFor(plate);
    const key = plateKey(plate.seedText, plate.variantIndex);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "plate-item";
    button.dataset["key"] = key;
    if (isCurrent) button.setAttribute("aria-current", "true");

    const no = document.createElement("span");
    no.className = "plate-no";
    setText(no, String(plate.plateNo).padStart(2, "0"));

    const thumb = document.createElement("span");
    thumb.className = "plate-thumb";
    setSvg(
      thumb,
      renderKamonSVG(structure, palette, { backdrop: false, label: structure.name }),
    );

    const text = document.createElement("span");
    text.className = "plate-text";
    const title = document.createElement("span");
    title.className = "plate-name";
    setText(title, structure.name);
    const sub = document.createElement("span");
    sub.className = "plate-sub";
    setText(sub, buildKamonSubtitle(structure.categoryLabel, structure.symmetryLabel));
    text.append(title, sub);

    button.append(no, thumb, text);
    button.addEventListener("click", () => handlers.onSelect(plate));

    const item = document.createElement("li");
    item.className = "plate-row";
    item.append(button);
    return item;
  };

  const resetConfirm = (): void => {
    confirm.hidden = true;
    clearButton.hidden = false;
  };

  return {
    resetConfirm,

    render(plates, palette, currentKey) {
      // 一覧を組み直すとフォーカス中のボタンが消えるため、同じ図版へ戻す
      const active = document.activeElement;
      const focusedKey =
        active instanceof HTMLElement && list.contains(active)
          ? (active.dataset["key"] ?? null)
          : null;

      list.replaceChildren();

      // 新しい図版を先頭に積む（FR-300.1）
      for (const plate of [...plates].reverse()) {
        const key = plateKey(plate.seedText, plate.variantIndex);
        list.append(buildItem(plate, palette, key === currentKey));
      }

      const hasPlates = plates.length > 0;
      list.hidden = !hasPlates;
      empty.hidden = hasPlates;
      setText(count, hasPlates ? `${plates.length} 葉` : "");
      if (!hasPlates) resetConfirm();
      clearButton.hidden = !hasPlates || !confirm.hidden;

      if (focusedKey !== null) {
        const restored = list.querySelector(`[data-key="${CSS.escape(focusedKey)}"]`);
        if (restored instanceof HTMLElement) restored.focus();
      }
    },
  };
}
