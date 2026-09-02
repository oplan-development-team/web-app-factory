import { SHAKE } from "../lib/constants.ts";
import { classifyTilt } from "../lib/tilt.ts";
import type { TiltBucket } from "../lib/types.ts";

/**
 * センサーの許可・購読・シェイク検出（FR-001〜003, FR-010, FR-021）。
 *
 * この層だけが DeviceMotion / DeviceOrientation を知っている。
 * 判定そのもの（classifyTilt）は lib 側の純関数に委ねる。
 */

export type PermissionOutcome = "granted" | "denied" | "unsupported";

/** iOS Safari だけが持つ requestPermission を型として表現する。 */
interface PermissionRequestable {
  requestPermission?: () => Promise<"granted" | "denied">;
}

export interface MotionCallbacks {
  /** シェイクを検知した。引数はその瞬間の傾き区分（取れなければ null）。 */
  onShake: (bucket: TiltBucket | null) => void;
  /** センサーが無いと判断した（FR-021）。呼び出し側はフォールバックへ倒す。 */
  onSensorAbsent: () => void;
}

export class MotionController {
  private readonly callbacks: MotionCallbacks;
  private readonly target: EventTarget;

  private listening = false;
  private permission: PermissionOutcome | null = null;

  private lastBeta: number | null = null;
  private lastGamma: number | null = null;

  private lastSample: { x: number; y: number; z: number } | null = null;
  private lastSampleAt = 0;
  private lastShakeAt = 0;

  /** 値を伴う devicemotion を 1 件でも受け取ったか。センサー有無の判別に使う。 */
  private receivedMotion = false;
  private probeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(callbacks: MotionCallbacks, target: EventTarget = window) {
    this.callbacks = callbacks;
    this.target = target;
  }

  get permissionState(): PermissionOutcome | null {
    return this.permission;
  }

  /**
   * 許可を要求する。
   *
   * iOS は「ユーザージェスチャーのハンドラから同期的に呼ばれた requestPermission」
   * しか受け付けない。await を挟んだ後の 2 つ目の呼び出しはジェスチャー文脈を失って
   * 拒否されるため、2 つの requestPermission を**先に両方起動してから**まとめて待つ。
   * この順序を崩してはならない（FR-001.1 / PLAN R1）。
   */
  async requestPermission(): Promise<PermissionOutcome> {
    const motion = (globalThis as { DeviceMotionEvent?: PermissionRequestable })
      .DeviceMotionEvent;
    const orientation = (globalThis as { DeviceOrientationEvent?: PermissionRequestable })
      .DeviceOrientationEvent;

    if (motion === undefined) {
      this.permission = "unsupported";
      return this.permission;
    }
    if (typeof motion.requestPermission !== "function") {
      // Android Chrome / PC は許可要求の仕組みを持たない。そのまま購読してよい（FR-002）。
      this.permission = "granted";
      return this.permission;
    }

    // ← ここで await しない。両方を同期的に起動する。
    const pending: Array<Promise<"granted" | "denied">> = [motion.requestPermission()];
    if (orientation !== undefined && typeof orientation.requestPermission === "function") {
      pending.push(orientation.requestPermission());
    }

    try {
      const results = await Promise.all(pending);
      this.permission = results.every((r) => r === "granted") ? "granted" : "denied";
    } catch {
      // 例外で止めない。タップで引ける経路へ降格させる（FR-003）。
      this.permission = "denied";
    }
    return this.permission;
  }

  /** 購読を開始し、センサー不在の監視タイマーを仕掛ける。 */
  start(): void {
    if (this.listening) return;
    this.listening = true;
    this.receivedMotion = false;
    this.lastSample = null;

    this.target.addEventListener("devicemotion", this.handleMotion as EventListener);
    this.target.addEventListener("deviceorientation", this.handleOrientation as EventListener);

    this.probeTimer = setTimeout(() => {
      // 実機は静止していても devicemotion を連続発火する。
      // 1 件も来ない = 振られていない、ではなく、センサーが無い（FR-021）。
      if (!this.receivedMotion) {
        this.stop();
        this.callbacks.onSensorAbsent();
      }
    }, SHAKE.SENSOR_PROBE_MS);
  }

  stop(): void {
    if (this.probeTimer !== null) {
      clearTimeout(this.probeTimer);
      this.probeTimer = null;
    }
    if (!this.listening) return;
    this.listening = false;
    this.target.removeEventListener("devicemotion", this.handleMotion as EventListener);
    this.target.removeEventListener("deviceorientation", this.handleOrientation as EventListener);
  }

  /** いま把握している姿勢。フォールバック時の表示にも使う。 */
  currentBucket(): TiltBucket | null {
    return classifyTilt(this.lastBeta, this.lastGamma);
  }

  private readonly handleOrientation = (event: DeviceOrientationEvent): void => {
    this.lastBeta = event.beta;
    this.lastGamma = event.gamma;
  };

  private readonly handleMotion = (event: DeviceMotionEvent): void => {
    const acceleration = event.accelerationIncludingGravity;
    if (acceleration === null) return;

    const { x, y, z } = acceleration;
    if (x === null || y === null || z === null) return;

    // ここではじめて「値のあるイベントが来た」と数える（FR-010.4）
    this.receivedMotion = true;

    const now = Date.now();
    const previous = this.lastSample;
    if (previous === null) {
      this.lastSample = { x, y, z };
      this.lastSampleAt = now;
      return;
    }
    if (now - this.lastSampleAt < SHAKE.MIN_SAMPLE_INTERVAL_MS) return;

    const delta = Math.hypot(x - previous.x, y - previous.y, z - previous.z);
    this.lastSample = { x, y, z };
    this.lastSampleAt = now;

    if (delta < SHAKE.THRESHOLD) return;
    // 1 回の振りで複数枚出ないようにクールダウンを置く（FR-010.3）
    if (now - this.lastShakeAt < SHAKE.COOLDOWN_MS) return;

    this.lastShakeAt = now;
    this.callbacks.onShake(this.currentBucket());
  };
}
