import { BUCKETS, FAMILY_LABEL, TOTAL_TYPES } from "../lib/constants.ts";
import { recordSpecimen } from "../lib/collection.ts";
import { drawSpecimen } from "../lib/gacha.ts";
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

const STANDBY_COPY: Record<StandbyState, { label: string; hint: string; state: string }> = {
  idle: {
    label: "振ってみる",
    hint: "タップしてセンサーを起動",
    state: "4方向の傾きが、4つの系統と響き合う。",
  },
  requesting: {
    label: "準備中…",
    hint: "センサーの使用許可を確認しています",
    state: "センサーの使用許可を確認しています。",
  },
  armed: {
    label: "振って！",
    hint: "うまく振れないときはタップでも引けます",
    state: "構えた向きが、出やすい系統を決める。",
  },
  fallback: {
    label: "タップで引く",
    hint: "この端末では傾きを取得できないため、向きは無作為に決まります",
    state: "傾きセンサーが使えないため、向きは無作為に選ばれます。",
  },
};

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
  private readonly shakeHint: HTMLElement;
  private readonly standbyState: HTMLElement;
  private readonly standbyProgress: HTMLElement;

  private collection: Collection;
  private persistent: boolean;
  private standby: StandbyState = "idle";
  private totalDraws = 0;
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
    this.shakeHint = requireHtml(root, "[data-shake-hint]");
    this.standbyState = requireHtml(root, "[data-standby-state]");
    this.standbyProgress = requireHtml(root, "[data-standby-progress]");

    const loaded = loadCollection(this.storage);
    this.collection = loaded.collection;
    this.persistent = loaded.persistent;

    this.bind(root);
    this.setStandby("idle");
    this.syncProgress();
    this.screens.show("standby");
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
    this.totalDraws += 1;

    if (this.storage !== null && this.persistent) {
      this.persistent = saveCollection(this.storage, this.collection);
    }

    const collected = Object.keys(this.collection).length;
    this.reveal.render(specimen, {
      isFirstDiscovery: result.isFirstDiscovery,
      totalDraws: this.totalDraws,
      collected,
      total: TOTAL_TYPES,
    });
    this.syncProgress();
    this.screens.show("reveal");
    this.screens.announce(this.announcement(specimen, result.isFirstDiscovery, collected));
  }

  private announcement(specimen: Specimen, isFirst: boolean, collected: number): string {
    const label = FAMILY_LABEL[specimen.family];
    const first = isFirst ? "はじめて発見。" : "";
    return `${label.en} ${label.ja} の ${specimen.rarity} が出ました。${first}図鑑は ${collected} / ${TOTAL_TYPES} です。`;
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
    setText(this.shakeHint, copy.hint);
    setText(this.standbyState, copy.state);
    this.shakeButton.dataset["state"] = state;
    this.shakeButton.disabled = state === "requesting";
  }

  private syncProgress(): void {
    setText(this.standbyProgress, `${Object.keys(this.collection).length} / ${TOTAL_TYPES}`);
  }
}
