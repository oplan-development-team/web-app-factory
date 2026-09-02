import { BUCKET_LABEL, FAMILY_LABEL } from "../lib/constants.ts";
import { patternSvg } from "../lib/patterns/index.ts";
import type { Specimen } from "../lib/types.ts";
import { requireHtml, setText } from "./dom.ts";

/** 出現演出画面の描画（FR-400〜404）。 */
export class RevealView {
  private readonly root: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly art: HTMLElement;
  private readonly rarity: HTMLElement;
  private readonly first: HTMLElement;
  private readonly familyEn: HTMLElement;
  private readonly familyJa: HTMLElement;
  private readonly tilt: HTMLElement;
  private readonly index: HTMLElement;
  private readonly progress: HTMLElement;

  constructor(root: ParentNode) {
    this.root = requireHtml(root, '[data-screen="reveal"]');
    this.stage = requireHtml(this.root, "[data-reveal-stage]");
    this.art = requireHtml(this.root, "[data-reveal-art]");
    this.rarity = requireHtml(this.root, "[data-reveal-rarity]");
    this.first = requireHtml(this.root, "[data-reveal-first]");
    this.familyEn = requireHtml(this.root, "[data-reveal-family-en]");
    this.familyJa = requireHtml(this.root, "[data-reveal-family-ja]");
    this.tilt = requireHtml(this.root, "[data-reveal-tilt]");
    this.index = requireHtml(this.root, "[data-reveal-index]");
    this.progress = requireHtml(this.root, "[data-reveal-progress]");
  }

  render(
    specimen: Specimen,
    options: { isFirstDiscovery: boolean; totalDraws: number; collected: number; total: number },
  ): void {
    const label = FAMILY_LABEL[specimen.family];

    // レア度は色として全体に効かせる。CSS 側が --accent を読む（FR-401）
    this.root.dataset["rarity"] = specimen.rarity;

    this.art.innerHTML = patternSvg(specimen.family, specimen.rarity, specimen.seed, {
      title: `${label.en} ${label.ja} の${specimen.rarity}の模様`,
    });

    setText(this.rarity, specimen.rarity);
    setText(this.familyEn, label.en);
    setText(this.familyJa, label.ja);
    setText(this.tilt, this.tiltText(specimen));
    setText(this.index, `№ ${String(options.totalDraws).padStart(3, "0")}`);
    setText(this.progress, `${options.collected} / ${options.total}`);

    this.first.hidden = !options.isFirstDiscovery;

    this.replay();
  }

  /**
   * 出現アニメーションを再生する。
   * クラスを付け直すだけでは 2 回目以降に再生されないので、
   * 一度外してレイアウトを読み、強制的に作り直す。
   */
  private replay(): void {
    this.stage.classList.remove("is-revealed");
    void this.stage.offsetWidth;
    this.stage.classList.add("is-revealed");
  }

  private tiltText(specimen: Specimen): string {
    if (specimen.bucket === null) {
      return "検出した傾き: なし（センサーなしのため無作為）";
    }
    const label = BUCKET_LABEL[specimen.bucket];
    return specimen.fromSensor
      ? `検出した傾き: ${label}`
      : `割り当てた傾き: ${label}（センサーなし）`;
  }
}
