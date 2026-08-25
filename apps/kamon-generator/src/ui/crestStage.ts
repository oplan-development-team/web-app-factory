/**
 * 右ページの紋表示面（SPEC 3.6 / FR-500）。
 *
 * empty / drafting / ready / error の 4 状態を `data-state` 一箇所で表し、
 * どの面を見せるかは CSS に任せる。DOM の付け外しをしないので、状態が変わっても
 * 領域の高さが動かない（FR-500.3）。
 *
 * drafting では汎用スピナーではなく「割り出し線」を出す。家紋は同心円と放射線の
 * ガイド上で作図されるため、待ち時間そのものが作図の所作として読める。
 */

import { draftGuideSVG } from "../lib/draftGuide";
import type { KamonStructure } from "../lib/kamon";
import type { Palette } from "../lib/palette";
import { renderKamonSVG } from "../lib/render";
import { setSvg, setText } from "./dom";

/** 割り出し面を見せる最短時間（FR-500.1）。これ未満だと瞬きのように消えてしまう */
export const MIN_DRAFT_MS = 260;

/** 割り出し線の色。朱を薄く使う（意匠の差し色を機能に限る方針に沿う） */
const GUIDE_STROKE = "rgba(195, 58, 46, 0.5)";
const GUIDE_STROKE_IDLE = "rgba(138, 128, 112, 0.42)";

export type StageState = "empty" | "drafting" | "ready" | "error";

export interface CrestView {
  structure: KamonStructure;
  palette: Palette;
  plateNo: number;
}

export interface CrestStageElements {
  stage: HTMLElement;
  mount: HTMLElement;
  caption: HTMLElement;
  name: HTMLElement;
  spec: HTMLElement;
  seed: HTMLElement;
  error: HTMLElement;
}

export interface CrestStage {
  state(): StageState;
  view(): CrestView | null;
  showEmpty(): void;
  /** 割り出し面へ移り、最短表示時間が過ぎたら解決する */
  beginDraft(): Promise<void>;
  present(view: CrestView): void;
  showError(message: string): void;
  /** 幾何を作り直さずに色だけ差し替える（FR-200.1） */
  recolor(palette: Palette): void;
}

function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 「植物紋 ／ 4 回回転対称 ／ 図版 03」のような諸元行 */
function describe(view: CrestView): string {
  const plate = String(view.plateNo).padStart(2, "0");
  return `${view.structure.categoryLabel}　／　${view.structure.symmetryLabel}　／　図版 ${plate}`;
}

function describeSeed(view: CrestView): string {
  return `種「${view.structure.seedText}」・第 ${view.structure.variantIndex + 1} 案`;
}

export function createCrestStage(elements: CrestStageElements): CrestStage {
  const { stage, mount, caption, name, spec, seed, error } = elements;
  let current: CrestView | null = null;
  let state: StageState = "empty";

  const setState = (next: StageState): void => {
    state = next;
    stage.dataset["state"] = next;
    caption.hidden = next !== "ready";
  };

  const paintCrest = (view: CrestView): void => {
    setSvg(mount, renderKamonSVG(view.structure, view.palette));
  };

  return {
    state: () => state,
    view: () => current,

    showEmpty() {
      current = null;
      setSvg(mount, draftGuideSVG({ stroke: GUIDE_STROKE_IDLE }));
      setText(name, "");
      setText(spec, "");
      setText(seed, "");
      setText(error, "");
      setState("empty");
    },

    beginDraft() {
      setSvg(mount, draftGuideSVG({ stroke: GUIDE_STROKE }));
      setState("drafting");
      if (prefersReducedMotion()) return Promise.resolve();
      return new Promise<void>((resolve) => window.setTimeout(resolve, MIN_DRAFT_MS));
    },

    present(view: CrestView) {
      current = view;
      setText(error, "");
      paintCrest(view);
      setText(name, view.structure.name);
      setText(spec, describe(view));
      setText(seed, describeSeed(view));
      setState("ready");
      // 再生成のたびに墨が入り直して見えるよう、アニメーションを付け直す
      mount.classList.remove("is-inked");
      void mount.offsetWidth;
      mount.classList.add("is-inked");
    },

    showError(message: string) {
      current = null;
      setSvg(mount, draftGuideSVG({ stroke: GUIDE_STROKE_IDLE }));
      // 先に面を出してから文言を入れる。role="alert" は非表示のまま文言を差し替えても
      // 読み上げられないことがあるため、可視化してから内容を変える
      setState("error");
      setText(error, message);
    },

    recolor(palette: Palette) {
      if (current === null) return;
      current = { ...current, palette };
      paintCrest(current);
    },
  };
}
