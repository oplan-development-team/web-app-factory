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
      <p>離すと、消えます。</p>
    </div>

    <div class="stage-indicator" id="stage-indicator" aria-hidden="true">
      <span class="stage-dot" data-stage="bud"></span>
      <span class="stage-dot" data-stage="peony"></span>
      <span class="stage-dot" data-stage="matsuba"></span>
      <span class="stage-dot" data-stage="chiri"></span>
    </div>

    <div class="press-affordance" id="press-affordance" aria-hidden="true"></div>
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
