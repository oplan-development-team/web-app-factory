import type { StageName } from './sparkler-physics.ts';
import { STAGE_RANGES } from './sparkler-physics.ts';

const INTRO_SEEN_KEY = 'ephemeral-sparkler:intro-seen';
const STAGE_ORDER: StageName[] = ['bud', 'peony', 'matsuba', 'chiri'];

export interface AppElements {
  root: HTMLElement;
  sceneCanvas: HTMLCanvasElement;
  intro: HTMLElement;
  stageIndicator: HTMLElement;
  stageDots: HTMLElement[];
  gripRing: HTMLElement;
  windArrow: HTMLElement;
  stabilityHud: HTMLElement;
  stabilityFill: HTMLElement;
  pressZone: HTMLElement;
  pressAffordance: HTMLElement;
  resultOverlay: HTMLElement;
  resultPhoto: HTMLImageElement;
  saveButton: HTMLButtonElement;
  retryButton: HTMLButtonElement;
  iosFallback: HTMLElement;
  iosPhoto: HTMLImageElement;
  iosCloseButton: HTMLButtonElement;
}

export function mountApp(root: HTMLElement): AppElements {
  root.innerHTML = `
    <canvas class="scene-canvas" id="scene-canvas" aria-hidden="true"></canvas>
    <div class="grain" aria-hidden="true"></div>

    <div class="intro" id="intro">
      <p>そっと長く、触れ続けてください。</p>
      <p>離すと、消えます。風が吹いたら、そっと押し返して。</p>
    </div>

    <div class="stability-hud" id="stability-hud" aria-hidden="true">
      <span class="stability-track">
        <span class="stability-fill" id="stability-fill"></span>
      </span>
    </div>

    <div class="stage-indicator" id="stage-indicator" aria-hidden="true">
      <span class="stage-dot" data-stage="bud"></span>
      <span class="stage-dot" data-stage="peony"></span>
      <span class="stage-dot" data-stage="matsuba"></span>
      <span class="stage-dot" data-stage="chiri"></span>
    </div>

    <div class="press-affordance" id="press-affordance" aria-hidden="true"></div>
    <div class="grip-ring" id="grip-ring" aria-hidden="true">
      <span class="wind-arrow" id="wind-arrow"></span>
    </div>
    <div
      class="press-zone"
      id="press-zone"
      role="button"
      tabindex="0"
      aria-label="長押しして線香花火に火を灯す"
    ></div>

    <div class="result-overlay" id="result-overlay" hidden>
      <p class="result-caption">光は、もう戻りません。</p>
      <figure class="photo-frame">
        <img id="result-photo" alt="燃え尽きた線香花火が残した光跡" />
      </figure>
      <div class="result-actions">
        <button type="button" class="btn" id="btn-save">記念写真として保存</button>
        <button type="button" class="btn btn-ghost" id="btn-retry">もう一度、灯す</button>
      </div>
    </div>

    <div class="ios-fallback" id="ios-fallback" hidden>
      <p>画像を長押しして、カメラロールに保存してください。</p>
      <img id="ios-photo" alt="燃え尽きた線香花火が残した光跡" />
      <button type="button" class="btn btn-ghost" id="btn-ios-close">閉じる</button>
    </div>
  `;

  const byId = <T extends HTMLElement>(id: string): T => {
    const el = root.querySelector<T>(`#${id}`);
    if (!el) throw new Error(`Missing required element #${id}`);
    return el;
  };

  return {
    root,
    sceneCanvas: byId('scene-canvas'),
    intro: byId('intro'),
    stageIndicator: byId('stage-indicator'),
    stageDots: Array.from(root.querySelectorAll<HTMLElement>('.stage-dot')),
    gripRing: byId('grip-ring'),
    windArrow: byId('wind-arrow'),
    stabilityHud: byId('stability-hud'),
    stabilityFill: byId('stability-fill'),
    pressZone: byId('press-zone'),
    pressAffordance: byId('press-affordance'),
    resultOverlay: byId('result-overlay'),
    resultPhoto: byId('result-photo'),
    saveButton: byId('btn-save'),
    retryButton: byId('btn-retry'),
    iosFallback: byId('ios-fallback'),
    iosPhoto: byId('ios-photo'),
    iosCloseButton: byId('btn-ios-close'),
  };
}

export function hasSeenIntro(): boolean {
  try {
    return window.localStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markIntroSeen(): void {
  try {
    window.localStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    // Storage unavailable (private mode, etc.) — showing the intro again is harmless.
  }
}

export function updateStageIndicator(dots: HTMLElement[], progressPercent: number): void {
  dots.forEach((dot, i) => {
    const stage = STAGE_ORDER[i];
    if (!stage) return;
    const [start] = STAGE_RANGES[stage];
    dot.classList.toggle('is-active', progressPercent >= start && progressPercent > 0);
  });
}

const STABILITY_WARNING_THRESHOLD = 45;
const STABILITY_DANGER_THRESHOLD = 78;

/**
 * Updates the wind-direction arrow (rotation + opacity from strength) and
 * the stability hairline (fill width from instability, with a warning/danger
 * class swap instead of continuous color interpolation — kept as a two-step
 * palette shift so it stays within the piece's existing token set). The
 * arrow itself now lives inside `.grip-ring` (see positionGripRing) rather
 * than a separate floating HUD, so this function's job is unchanged — only
 * where its target element sits in the DOM/viewport has moved.
 */
export function updateWindHud(
  el: { windArrow: HTMLElement; stabilityFill: HTMLElement },
  gustAngleRadians: number,
  gustStrength: number,
  instability: number,
): void {
  const degrees = (gustAngleRadians * 180) / Math.PI + 90;
  el.windArrow.style.transform = `rotate(${degrees}deg)`;
  el.windArrow.style.opacity = String(Math.min(0.9, gustStrength * 1.1));

  const remaining = Math.max(0, 100 - instability);
  el.stabilityFill.style.width = `${remaining}%`;
  el.stabilityFill.classList.toggle(
    'is-warning',
    instability >= STABILITY_WARNING_THRESHOLD && instability < STABILITY_DANGER_THRESHOLD,
  );
  el.stabilityFill.classList.toggle('is-danger', instability >= STABILITY_DANGER_THRESHOLD);
}

export function positionPressZone(el: HTMLElement, handX: number, handY: number): void {
  const width = Math.min(220, Math.max(130, window.innerWidth * 0.42));
  const height = Math.min(280, Math.max(190, window.innerHeight * 0.32));
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.left = `${handX - width / 2}px`;
  el.style.top = `${handY - height / 2}px`;
}

export function positionAffordance(el: HTMLElement, handX: number, handY: number): void {
  el.style.left = `${handX}px`;
  el.style.top = `${handY}px`;
}

/**
 * Centers the grip-ring (and, inside it, the wind-direction arrow — see
 * updateWindHud) on the same grip point as the press-affordance circle. The
 * two occupy the same screen position but never show at once: the
 * affordance invites the first press, the ring takes over once burning
 * starts (see main.ts show/hideAffordance and the is-visible toggles).
 */
export function positionGripRing(el: HTMLElement, handX: number, handY: number): void {
  el.style.left = `${handX}px`;
  el.style.top = `${handY}px`;
}
