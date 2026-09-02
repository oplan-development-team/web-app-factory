import {
  BUCKETS,
  BUCKET_HINT_LABEL,
  BUCKET_HINT_ROTATION,
  FAMILY_LABEL,
  RARITY_LABEL_JA,
  TOTAL_TYPES,
} from "../lib/constants.ts";
import { recordSpecimen } from "../lib/collection.ts";
import { drawSpecimen } from "../lib/gacha.ts";
import { patternSvg } from "../lib/patterns/index.ts";
import { randPick } from "../lib/rng.ts";
import { defaultStorage, loadCollection, saveCollection, type StorageLike } from "../lib/storage.ts";
import type { Collection, Rng, Specimen, TiltBucket } from "../lib/types.ts";
import { CollectionView } from "./collectionView.ts";
import { requireButton, requireHtml, setText } from "./dom.ts";
import { MotionController } from "./motion.ts";
import { RevealView } from "./reveal.ts";
import { ScreenManager } from "./screens.ts";

/** 待機画面の内部状態（PLAN §3）。 */
type StandbyState = "idle" | "requesting" | "armed" | "fallback";

export interface AppOptions {
  root: ParentNode;
  /** 乱数源。テストで差し替える（NFR-008.3）。 */
  rng?: Rng;
  now?: () => Date;
  storage?: StorageLike | null;
  /** センサー購読先。テストでは合成イベント用の EventTarget を渡す。 */
  motionTarget?: EventTarget;
}

interface StandbyCopy {
  label: string;
  headline: string;
  sub: string;
  note: string;
}

const STANDBY_COPY: Record<StandbyState, StandbyCopy> = {
  idle: {
    label: "振ってみる",
    headline: "端末を振ってみてください",
    sub: "持ち方によって出やすい模様が変わります",
    note: "",
  },
  requesting: {
    label: "準備中…",
    headline: "端末を振ってみてください",
    sub: "持ち方によって出やすい模様が変わります",
    note: "センサーの使用許可を確認しています",
  },
  armed: {
    label: "振って！",
    headline: "そのまま振ってください",
    sub: "構えた向きで出やすい模様が変わります",
    note: "うまく振れないときはタップでも引けます",
  },
  fallback: {
    label: "タップで引く",
    headline: "タップしてみてください",
    sub: "この端末では傾きを取得できないため、向きは無作為に決まります",
    note: "",
  },
};

/** 待機画面のゴースト模様。毎回同じ見え方にしたいのでシードを固定する。 */
const GHOST_SEED = 20260902;

export class App {
  private readonly screens: ScreenManager;
  private readonly reveal: RevealView;
  private readonly collectionView: CollectionView;
  private readonly motion: MotionController;

  private readonly rng: Rng;
  private readonly now: () => Date;
  private readonly storage: StorageLike | null;

  private readonly shakeButton: HTMLButtonElement;
  private readonly shakeLabel: HTMLElement;
  private readonly shakeIcon: HTMLElement;
  private readonly shakeNote: HTMLElement;
  private readonly headline: HTMLElement;
  private readonly sub: HTMLElement;
  private readonly standbyProgress: HTMLElement;

  private collection: Collection;
  private persistent: boolean;
  private standby: StandbyState = "idle";
  /** 許可済みなら再要求しない（FR-403.1）。 */
  private permissionGranted = false;

  constructor(options: AppOptions) {
    const { root } = options;
    this.rng = options.rng ?? Math.random;
    this.now = options.now ?? (() => new Date());
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;

    this.screens = new ScreenManager(root);
    this.reveal = new RevealView(root);
    this.collectionView = new CollectionView(root);
    this.motion = new MotionController(
      {
        onShake: (bucket) => this.draw(bucket, true),
        onSensorAbsent: () => {
          // センサーが無いと分かった時点で、その操作をそのまま 1 回の抽選にする（FR-021）
          this.setStandby("fallback");
          this.drawWithoutSensor();
        },
      },
      options.motionTarget ?? window,
    );

    this.shakeButton = requireButton(root, "[data-shake-button]");
    this.shakeLabel = requireHtml(root, "[data-shake-label]");
    this.shakeIcon = requireHtml(root, "[data-shake-icon]");
    this.shakeNote = requireHtml(root, "[data-shake-hint]");
    this.headline = requireHtml(root, "[data-standby-headline]");
    this.sub = requireHtml(root, "[data-standby-sub]");
    this.standbyProgress = requireHtml(root, "[data-standby-progress]");

    const loaded = loadCollection(this.storage);
    this.collection = loaded.collection;
    this.persistent = loaded.persistent;

    this.renderGhost(root);
    this.renderTiltHints(root);
    this.bind(root);
    this.setStandby("idle");
    this.syncProgress();
    this.screens.show("standby");
  }

  /** 待機画面中央の薄い模様。実際の生成器で描き、出てくるものの予告にする。 */
  private renderGhost(root: ParentNode): void {
    requireHtml(root, "[data-standby-ghost]").innerHTML = patternSvg(
      "FLOW",
      "COMMON",
      GHOST_SEED,
    );
  }

  /** 傾き 4 種を、端末の姿勢を模したアイコン列で示す（表では説明しない）。 */
  private renderTiltHints(root: ParentNode): void {
    const list = requireHtml(root, "[data-tilt-hints]");
    list.replaceChildren(
      ...BUCKETS.map((bucket) => {
        const item = document.createElement("li");
        item.className = "tilt-hint";
        item.dataset["bucket"] = bucket;
        item.innerHTML =
          `<span class="tilt-hint__icon" aria-hidden="true">` +
          `<svg viewBox="0 0 16 24" width="16" height="24" ` +
          `style="transform:rotate(${BUCKET_HINT_ROTATION[bucket]}deg)">` +
          `<rect x="1" y="1" width="14" height="22" rx="2.5" stroke="currentColor" ` +
          `stroke-width="1.3" fill="none"/></svg></span>` +
          `<span class="tilt-hint__label"></span>`;
        setText(requireHtml(item, ".tilt-hint__label"), BUCKET_HINT_LABEL[bucket]);
        return item;
      }),
    );
  }

  private bind(root: ParentNode): void {
    // 振る／引く（FR-001）。armed 中のタップも同じ経路を通す（FR-022）
    this.shakeButton.addEventListener("click", () => {
      void this.onShakeButton();
    });

    requireButton(root, "[data-shake-again]").addEventListener("click", () => {
      void this.onShakeAgain();
    });

    for (const button of root.querySelectorAll("[data-open-collection]")) {
      button.addEventListener("click", () => this.openCollection());
    }
    requireButton(root, "[data-close-collection]").addEventListener("click", () => {
      this.closeCollection();
    });
    requireButton(root, "[data-close-reveal]").addEventListener("click", () => {
      this.motion.stop();
      if (this.standby === "armed") this.setStandby("idle");
      this.screens.show("standby");
    });
  }

  private async onShakeButton(): Promise<void> {
    // すでに待ち受け中／フォールバック中なら、タップ自体が 1 回の抽選になる
    if (this.standby === "armed") {
      this.draw(this.motion.currentBucket(), true);
      return;
    }
    if (this.standby === "fallback") {
      this.drawWithoutSensor();
      return;
    }
    if (this.standby === "requesting") return;

    await this.arm();
  }

  /** 許可を取り、センサー待ち受けへ入る。取れなければフォールバックで 1 回引く。 */
  private async arm(): Promise<void> {
    if (this.permissionGranted) {
      this.setStandby("armed");
      this.motion.start();
      return;
    }

    this.setStandby("requesting");
    const outcome = await this.motion.requestPermission();

    if (outcome === "granted") {
      this.permissionGranted = true;
      this.setStandby("armed");
      this.motion.start();
      return;
    }

    // 拒否・非対応。止めずにタップで引ける状態へ降格する（FR-003 / FR-020）
    this.setStandby("fallback");
    this.screens.announce(
      outcome === "denied"
        ? "センサーの使用が許可されなかったため、タップで引くモードに切り替えました。"
        : "この端末では傾きを取得できないため、タップで引くモードに切り替えました。",
    );
    this.drawWithoutSensor();
  }

  private async onShakeAgain(): Promise<void> {
    this.screens.show("standby");
    if (this.standby === "fallback") {
      // センサーが無い環境では「もう一度振る」がそのまま次の抽選になる
      this.drawWithoutSensor();
      return;
    }
    await this.arm();
  }

  /** センサー無しの抽選。傾き区分は 4 つから一様ランダムに割り当てる（FR-020.2）。 */
  private drawWithoutSensor(): void {
    this.draw(randPick(this.rng, BUCKETS), false);
  }

  private draw(bucket: TiltBucket | null, fromSensor: boolean): void {
    this.motion.stop();

    const specimen = drawSpecimen(bucket, this.rng, fromSensor);
    const result = recordSpecimen(this.collection, specimen, this.now());
    this.collection = result.collection;

    if (this.storage !== null && this.persistent) {
      this.persistent = saveCollection(this.storage, this.collection);
    }

    this.reveal.render(specimen, { isFirstDiscovery: result.isFirstDiscovery });
    this.syncProgress();
    this.screens.show("reveal");
    this.screens.announce(
      this.announcement(specimen, result.isFirstDiscovery, Object.keys(this.collection).length),
    );
  }

  private announcement(specimen: Specimen, isFirst: boolean, collected: number): string {
    const label = FAMILY_LABEL[specimen.family];
    const first = isFirst ? "はじめて発見。" : "";
    return (
      `${label.en} ${label.ja} の ${RARITY_LABEL_JA[specimen.rarity]} が出ました。` +
      `${first}図鑑は ${collected} / ${TOTAL_TYPES} です。`
    );
  }

  private openCollection(): void {
    this.motion.stop();
    this.collectionView.render(this.collection, { persistent: this.persistent });
    this.screens.show("collection");
  }

  private closeCollection(): void {
    this.screens.show("standby");
    // 図鑑から戻ったら待ち受けは切れているので、押せば引ける表示に戻す
    if (this.standby === "armed") this.setStandby("idle");
  }

  private setStandby(state: StandbyState): void {
    this.standby = state;
    const copy = STANDBY_COPY[state];
    setText(this.shakeLabel, copy.label);
    setText(this.headline, copy.headline);
    setText(this.sub, copy.sub);
    setText(this.shakeNote, copy.note);
    this.shakeButton.dataset["state"] = state;
    this.shakeButton.disabled = state === "requesting";
    // センサーを使わないモードでは端末を振るアイコンを出さない
    this.shakeIcon.hidden = state === "fallback";
  }

  private syncProgress(): void {
    setText(this.standbyProgress, `${Object.keys(this.collection).length} / ${TOTAL_TYPES}`);
  }
}
