import type { Phase, Settings, Vec2, Zone, LogEntry } from './types';
import { buildZones, TORII_ZONE_ID, SAYONARA_ZONE_ID, VIRTUAL_W, VIRTUAL_H } from './board';
import { DriftField } from './noise';

const IDLE_SPEED_THRESHOLD = 10; // 仮想px/s。これ以下なら「動いていない」とみなす
const LAND_DWELL_SECONDS = 1.15; // 答えゾーン上に留まり続けて着地するまでの秒数
const RETURN_LERP_RATE = 2.2;
const ENGAGE_LERP_RATE = 9;
const DAMPING = 0.86;
const DWELL_ENTER_FACTOR = 1.05; // ゾーン半径のこの倍率以内なら滞在中とみなす

export const DEFAULT_SETTINGS: Settings = {
  idleSeconds: 3,
  driftSpeed: 0.35,
  driftStrength: 260,
  attractionRadius: 190,
  attractionStrength: 520,
};

export interface EngineCallbacks {
  onPhaseChange?: (phase: Phase) => void;
  onLand?: (zone: Zone) => void;
  onLog?: (entry: LogEntry) => void;
}

export class SeanceEngine {
  readonly zones: Zone[] = buildZones();
  settings: Settings = { ...DEFAULT_SETTINGS };

  phase: Phase = 'setup';
  coin: Vec2 = { x: VIRTUAL_W / 2, y: 96 };
  velocity: Vec2 = { x: 0, y: 0 };

  question = '';
  sequence: string[] = [];
  sessionStartedAt = 0;
  landedZoneId: string | null = null;
  hintZoneId: string | null = null;

  private drift = new DriftField(Date.now() % 100000);
  private idleTimer = 0;
  private avgSpeed = 0;
  private prevCentroid: Vec2 | null = null;
  private dwellZoneId: string | null = null;
  private dwellTime = 0;
  /** 着地後に一度でも指が全て離れたか（=次の接触を明示的な「続ける」とみなせるか） */
  private landedFingersLifted = false;

  constructor(private callbacks: EngineCallbacks = {}) {}

  private setPhase(p: Phase): void {
    if (this.phase === p) return;
    this.phase = p;
    this.callbacks.onPhaseChange?.(p);
  }

  /** 質問入力を終えて盤面を有効化する */
  startRound(question: string): void {
    this.question = question.trim();
    this.sequence = [];
    this.sessionStartedAt = Date.now();
    this.landedZoneId = null;
    this.coin = { x: VIRTUAL_W / 2, y: 96 };
    this.velocity = { x: 0, y: 0 };
    this.idleTimer = 0;
    this.avgSpeed = 0;
    this.prevCentroid = null;
    this.dwellZoneId = null;
    this.dwellTime = 0;
    this.drift.reset();
    this.setPhase('ready');
  }

  /** 「続ける」操作: 着地状態から追跡に復帰する */
  continueRound(): void {
    if (this.phase !== 'landed') return;
    this.landedZoneId = null;
    this.idleTimer = 0;
    this.avgSpeed = 0;
    this.prevCentroid = null;
    this.dwellZoneId = null;
    this.dwellTime = 0;
    this.landedFingersLifted = false;
    this.drift.reset();
    this.setPhase('ready');
  }

  /** 「終了する」操作 or 鳥居/さようなら着地: セッションを終える */
  private endSession(cause: 'torii' | 'sayonara' | 'manual'): void {
    void cause;
    this.setPhase('ended');
    const entry: LogEntry = {
      question: this.question,
      sequence: this.sequence.join(''),
      startedAt: this.sessionStartedAt,
      endedAt: Date.now(),
      attempts: this.sequence.length,
    };
    this.callbacks.onLog?.(entry);
  }

  endManually(): void {
    if (this.phase === 'landed' || this.phase === 'ready' || this.phase === 'engaged' || this.phase === 'drifting') {
      this.endSession('manual');
    }
  }

  /** setup フェーズへ戻り、新しいセッションを開始できるようにする */
  resetToSetup(): void {
    this.question = '';
    this.sequence = [];
    this.landedZoneId = null;
    this.hintZoneId = null;
    this.coin = { x: VIRTUAL_W / 2, y: 96 };
    this.velocity = { x: 0, y: 0 };
    this.setPhase('setup');
  }

  /**
   * 毎フレーム呼び出す。
   * @param centroid 現在の全接触点の重心（仮想座標系）。指が無ければ null。
   */
  update(dt: number, centroid: Vec2 | null, fingerCount: number): void {
    if (this.phase === 'setup' || this.phase === 'ended') return;

    if (this.phase === 'landed') {
      // 「続ける」の暗黙トリガーは"指を一度離してから置き直す"という
      // 明示的な再接触のみ。着地の瞬間から指を置いたままの連続接触では、
      // 答えを読む間もなく1フレームで自動的に続いてしまうため反応しない。
      if (fingerCount === 0) {
        this.landedFingersLifted = true;
      } else if (this.landedFingersLifted) {
        this.continueRound();
      } else {
        return;
      }
    }

    if (fingerCount === 0) {
      // 指が全て離れた: 鳥居へ緩やかに帰還し、ラウンドを一時停止する
      if (this.phase === 'engaged' || this.phase === 'drifting') {
        this.easeToward({ x: VIRTUAL_W / 2, y: 96 }, dt, RETURN_LERP_RATE);
        const dx = this.coin.x - VIRTUAL_W / 2;
        const dy = this.coin.y - 96;
        if (Math.hypot(dx, dy) < 4) {
          this.idleTimer = 0;
          this.avgSpeed = 0;
          this.prevCentroid = null;
          this.setPhase('ready');
        }
      }
      return;
    }

    if (this.phase === 'ready') {
      this.setPhase('engaged');
    }

    if (this.phase === 'engaged' && centroid) {
      const speed = this.prevCentroid
        ? Math.hypot(centroid.x - this.prevCentroid.x, centroid.y - this.prevCentroid.y) / Math.max(dt, 1 / 240)
        : 0;
      this.avgSpeed = this.avgSpeed * 0.85 + speed * 0.15;
      this.prevCentroid = centroid;

      if (this.avgSpeed < IDLE_SPEED_THRESHOLD) {
        this.idleTimer += dt;
      } else {
        this.idleTimer = 0;
      }

      this.easeToward(centroid, dt, ENGAGE_LERP_RATE);

      if (this.idleTimer >= this.settings.idleSeconds) {
        this.setPhase('drifting');
        this.dwellZoneId = null;
        this.dwellTime = 0;
      }
      return;
    }

    if (this.phase === 'drifting') {
      // 指が再び大きく動いたら追跡へ復帰
      if (centroid && this.prevCentroid) {
        const speed = Math.hypot(centroid.x - this.prevCentroid.x, centroid.y - this.prevCentroid.y) / Math.max(dt, 1 / 240);
        this.avgSpeed = this.avgSpeed * 0.8 + speed * 0.2;
        if (this.avgSpeed > IDLE_SPEED_THRESHOLD * 2.2) {
          this.prevCentroid = centroid;
          this.idleTimer = 0;
          this.setPhase('engaged');
          return;
        }
      }
      if (centroid) this.prevCentroid = centroid;
      this.stepDrift(dt);
    }
  }

  private easeToward(target: Vec2, dt: number, rate: number): void {
    const k = 1 - Math.exp(-rate * dt);
    this.coin.x += (target.x - this.coin.x) * k;
    this.coin.y += (target.y - this.coin.y) * k;
  }

  private stepDrift(dt: number): void {
    const n = this.drift.step(dt, this.settings.driftSpeed);
    this.velocity.x += n.x * this.settings.driftStrength * dt;
    this.velocity.y += n.y * this.settings.driftStrength * dt;

    let strongestZone: Zone | null = null;
    let strongestPull = 0;
    for (const zone of this.zones) {
      const dx = zone.x - this.coin.x;
      const dy = zone.y - this.coin.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      if (dist < this.settings.attractionRadius) {
        const pull = this.settings.attractionStrength * (1 - dist / this.settings.attractionRadius);
        this.velocity.x += (dx / dist) * pull * dt;
        this.velocity.y += (dy / dist) * pull * dt;
        if (pull > strongestPull) {
          strongestPull = pull;
          strongestZone = zone;
        }
      }
    }
    this.hintZoneId = strongestZone?.id ?? null;

    const dampingFactor = Math.pow(DAMPING, dt * 60);
    this.velocity.x *= dampingFactor;
    this.velocity.y *= dampingFactor;

    this.coin.x += this.velocity.x * dt;
    this.coin.y += this.velocity.y * dt;
    this.coin.x = Math.max(40, Math.min(VIRTUAL_W - 40, this.coin.x));
    this.coin.y = Math.max(40, Math.min(VIRTUAL_H - 40, this.coin.y));

    // 滞在判定
    let onZone: Zone | null = null;
    for (const zone of this.zones) {
      const dist = Math.hypot(zone.x - this.coin.x, zone.y - this.coin.y);
      if (dist < zone.radius * DWELL_ENTER_FACTOR) {
        onZone = zone;
        break;
      }
    }

    if (onZone) {
      if (this.dwellZoneId === onZone.id) {
        this.dwellTime += dt;
      } else {
        this.dwellZoneId = onZone.id;
        this.dwellTime = 0;
      }
      if (this.dwellTime >= LAND_DWELL_SECONDS) {
        this.land(onZone);
      }
    } else {
      this.dwellZoneId = null;
      this.dwellTime = 0;
    }
  }

  private land(zone: Zone): void {
    this.coin.x = zone.x;
    this.coin.y = zone.y;
    this.velocity = { x: 0, y: 0 };
    this.landedZoneId = zone.id;
    this.hintZoneId = null;
    this.landedFingersLifted = false;
    this.callbacks.onLand?.(zone);

    if (zone.id === TORII_ZONE_ID || zone.id === SAYONARA_ZONE_ID) {
      this.endSession(zone.id === TORII_ZONE_ID ? 'torii' : 'sayonara');
      return;
    }

    this.sequence.push(zone.label);
    this.setPhase('landed');
  }

  /** ドウェル進捗（0..1）。UI上の微細なフィードバックに利用可能。 */
  get dwellProgress(): number {
    return Math.min(1, this.dwellTime / LAND_DWELL_SECONDS);
  }
}
