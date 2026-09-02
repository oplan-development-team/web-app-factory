import { FAMILIES, FAMILY_LABEL, RARITIES, TOTAL_TYPES } from "../lib/constants.ts";
import { collectedInFamily, typeIdOf } from "../lib/collection.ts";
import { patternSvg } from "../lib/patterns/index.ts";
import type { Collection, Family, Rarity } from "../lib/types.ts";
import { requireHtml, setText } from "./dom.ts";

/** 図鑑画面の描画（FR-500〜504）。 */
export class CollectionView {
  private readonly root: HTMLElement;
  private readonly sections: HTMLElement;
  private readonly count: HTMLElement;
  private readonly meter: HTMLElement;
  private readonly meterFill: HTMLElement;
  private readonly note: HTMLElement;

  constructor(root: ParentNode) {
    this.root = requireHtml(root, '[data-screen="collection"]');
    this.sections = requireHtml(this.root, "[data-collection-sections]");
    this.count = requireHtml(this.root, "[data-collection-count]");
    this.meter = requireHtml(this.root, "[data-collection-meter]");
    this.meterFill = requireHtml(this.root, "[data-collection-meter-fill]");
    this.note = requireHtml(this.root, "[data-collection-note]");
  }

  render(collection: Collection, options: { persistent: boolean }): void {
    const collected = Object.keys(collection).length;

    setText(this.count, `${collected} / ${TOTAL_TYPES}`);
    this.meter.setAttribute("aria-valuenow", String(collected));
    this.meterFill.style.width = `${(collected / TOTAL_TYPES) * 100}%`;

    // 永続化できない環境では黙って消えるより先に伝える（FR-201.3）
    this.note.hidden = options.persistent;
    if (!options.persistent) {
      setText(
        this.note,
        "この環境では保存ができないため、ページを閉じると図鑑はリセットされます。",
      );
    }

    this.sections.replaceChildren(
      ...FAMILIES.map((family) => this.buildSection(family, collection)),
    );
  }

  private buildSection(family: Family, collection: Collection): HTMLElement {
    const label = FAMILY_LABEL[family];
    const section = document.createElement("section");
    section.className = "family";
    section.dataset["family"] = family;

    const head = document.createElement("div");
    head.className = "family__head";
    head.innerHTML =
      `<h3 class="family__name"><span class="family__en"></span>` +
      `<span class="family__ja"></span></h3>` +
      `<p class="family__tally"></p>`;
    setText(requireHtml(head, ".family__en"), label.en);
    setText(requireHtml(head, ".family__ja"), label.ja);
    setText(
      requireHtml(head, ".family__tally"),
      `${collectedInFamily(collection, family)}/${RARITIES.length}`,
    );

    const grid = document.createElement("div");
    grid.className = "family__grid";
    grid.append(...RARITIES.map((rarity) => this.buildCell(family, rarity, collection)));

    section.append(head, grid);
    return section;
  }

  private buildCell(family: Family, rarity: Rarity, collection: Collection): HTMLElement {
    const entry = collection[typeIdOf(family, rarity)];
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset["rarity"] = rarity;
    cell.dataset["state"] = entry === undefined ? "locked" : "found";

    const frame = document.createElement("div");
    frame.className = "cell__frame";

    if (entry === undefined) {
      // 未収集は破線枠 + ?（FR-502.2）
      frame.innerHTML = `<span class="cell__unknown" aria-hidden="true">?</span>`;
      cell.append(frame, this.buildCaption(rarity, "未発見"));
      cell.setAttribute(
        "aria-label",
        `${FAMILY_LABEL[family].ja} の ${rarity}: 未発見`,
      );
      return cell;
    }

    // 収集済みは firstSeed から再生成する。見た目は初回取得時から変わらない（FR-200.2）
    frame.innerHTML = patternSvg(family, rarity, entry.firstSeed);
    cell.append(frame, this.buildCaption(rarity, `×${entry.count}`));
    cell.setAttribute(
      "aria-label",
      `${FAMILY_LABEL[family].ja} の ${rarity}: 発見済み、${entry.count}回`,
    );
    return cell;
  }

  private buildCaption(rarity: Rarity, tally: string): HTMLElement {
    const caption = document.createElement("p");
    caption.className = "cell__caption";
    caption.innerHTML = `<span class="cell__rarity"></span><span class="cell__tally"></span>`;
    setText(requireHtml(caption, ".cell__rarity"), rarity);
    setText(requireHtml(caption, ".cell__tally"), tally);
    return caption;
  }
}
