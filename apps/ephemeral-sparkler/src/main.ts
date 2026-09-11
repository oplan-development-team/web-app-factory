// Only the Japanese-glyph subset, and only the two weights actually used in
// the UI (see style.css) — the unscoped per-weight CSS pulls in every
// language subset (latin, cyrillic, vietnamese, ...) and balloons the bundle.
import '@fontsource/noto-serif-jp/japanese-300.css';
import '@fontsource/noto-serif-jp/japanese-500.css';
import './style.css';
import {
  mountApp,
  hasSeenIntro,
  markIntroSeen,
  updateStageIndicator,
  updateWindHud,
  positionPressZone,
  positionAffordance,
  positionGripRing,
} from './ui.ts';
import { bindHoldInput } from './input.ts';
import { SparklerRenderer } from './renderer.ts';
import {
  ParticleSystem,
  emberBrightnessForProgress,
  getStageWeights,
  TOTAL_BURN_SECONDS,
} from './sparkler-physics.ts';
import { WindSystem, StabilityMeter, type WindState } from './wind.ts';
import { buildFileName, downloadPng, isIOS } from './afterglowExport.ts';

type Phase = 'idle' | 'burning' | 'misfiring' | 'naturalEnding' | 'result';

const MISFIRE_DURATION = 0.7;
const NATURAL_END_DURATION = 1.4;
const MAX_FRAME_DT = 0.05;
const IDLE_EMBER_BRIGHTNESS = 0.06;
const INTRO_AUTO_HIDE_MS = 6000;
/** px/s² applied to lit sparks at full gust strength — visibly blows them sideways. */
const WIND_PARTICLE_FORCE = 220;
/** Gust state used to draw the stick sway when not actively burning (no wind at all). */
const CALM_GUST: WindState = { dx: 0, dy: 0, strength: 0, angle: 0 };

function init(): void {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app root element is missing');

  const el = mountApp(root);
  const renderer = new SparklerRenderer(el.sceneCanvas);
  const particles = new ParticleSystem(
    () => renderer.geometry.emberX,
    () => renderer.geometry.emberY,
  );

  let phase: Phase = 'idle';
  let progress = 0;
  let brightnessAtTransition = 0;
  let transitionTimer = 0;
  let lastTime = performance.now();

  const wind = new WindSystem();
  const stability = new StabilityMeter();
  let pointerOffsetX = 0;
  let pointerOffsetY = 0;
  let hasPointerControl = false;
  // Drives the stick's visual sway (see renderer.ts drawStick). Mirrors the
  // gust already driving the stability meter and particle drift — not a
  // second wind source — and is reset to calm whenever burning stops so the
  // stick doesn't hang mid-sway during a misfire/ending transition.
  let currentGust: WindState = CALM_GUST;

  function syncGeometry(): void {
    renderer.resize();
    const geo = renderer.geometry;
    positionPressZone(el.pressZone, geo.handX, geo.handY);
    positionAffordance(el.pressAffordance, geo.handX, geo.handY);
    positionGripRing(el.gripRing, geo.handX, geo.handY);
  }

  function showIntroIfFirstVisit(): void {
    if (hasSeenIntro()) return;
    markIntroSeen();
    requestAnimationFrame(() => el.intro.classList.add('is-visible'));
    window.setTimeout(() => el.intro.classList.remove('is-visible'), INTRO_AUTO_HIDE_MS);
  }

  function showAffordance(): void {
    el.pressAffordance.classList.add('is-visible');
  }

  function hideAffordance(): void {
    el.pressAffordance.classList.remove('is-visible');
  }

  function startBurning(source: 'pointer' | 'keyboard'): void {
    if (phase !== 'idle') return;
    el.intro.classList.remove('is-visible');
    hideAffordance();
    el.stageIndicator.classList.add('is-visible');
    el.gripRing.classList.add('is-visible');
    el.stabilityHud.classList.add('is-visible');
    phase = 'burning';
    progress = 0;
    particles.clear();
    stability.reset();
    pointerOffsetX = 0;
    pointerOffsetY = 0;
    // A pointer hold can always aim a counter-nudge, even if it stays put —
    // staying put then correctly counts as "no counter" (see wind.ts).
    // Keyboard holds have no position to report and get a fixed leniency.
    hasPointerControl = source === 'pointer';
  }

  function releaseHold(): void {
    if (phase !== 'burning') return;
    brightnessAtTransition = emberBrightnessForProgress(progress);
    transitionTimer = 0;
    particles.emitMisfireBurst();
    phase = 'misfiring';
    el.gripRing.classList.remove('is-visible');
    el.stabilityHud.classList.remove('is-visible');
    currentGust = CALM_GUST;
  }

  function finishNaturally(currentBrightness: number): void {
    brightnessAtTransition = currentBrightness;
    transitionTimer = 0;
    particles.emitFinalEmbers();
    phase = 'naturalEnding';
    el.gripRing.classList.remove('is-visible');
    el.stabilityHud.classList.remove('is-visible');
    currentGust = CALM_GUST;
  }

  function enterResult(): void {
    phase = 'result';
    el.stageIndicator.classList.remove('is-visible');
    const dataUrl = renderer.toPngDataUrl();
    el.resultPhoto.src = dataUrl;
    el.resultOverlay.hidden = false;
    requestAnimationFrame(() => el.resultOverlay.classList.add('is-visible'));
  }

  function resetSimulation(): void {
    phase = 'idle';
    progress = 0;
    transitionTimer = 0;
    particles.clear();
    renderer.resetAfterglow();
    el.resultOverlay.classList.remove('is-visible');
    el.resultOverlay.hidden = true;
    el.iosFallback.classList.remove('is-visible');
    el.iosFallback.hidden = true;
    el.gripRing.classList.remove('is-visible');
    el.stabilityHud.classList.remove('is-visible');
    currentGust = CALM_GUST;
    stability.reset();
    updateStageIndicator(el.stageDots, 0);
    showAffordance();
  }

  function handleSaveClick(): void {
    const dataUrl = el.resultPhoto.src;
    const filename = buildFileName();
    if (isIOS()) {
      el.iosPhoto.src = dataUrl;
      el.iosFallback.hidden = false;
      requestAnimationFrame(() => el.iosFallback.classList.add('is-visible'));
      return;
    }
    downloadPng(dataUrl, filename);
  }

  function closeIosFallback(): void {
    el.iosFallback.classList.remove('is-visible');
    el.iosFallback.hidden = true;
  }

  function frame(now: number): void {
    const dt = Math.min(MAX_FRAME_DT, (now - lastTime) / 1000);
    lastTime = now;

    let emberBrightness = IDLE_EMBER_BRIGHTNESS;
    let pulseStrength = 0;
    let showStick = true;

    if (phase === 'burning') {
      progress = Math.min(100, progress + (dt / TOTAL_BURN_SECONDS) * 100);

      // Difficulty ramps up as the burn progresses — a calm bud stage, a
      // genuinely tense 散り際. See wind.ts for the gust timeline itself.
      const difficultyScale = 0.35 + 0.65 * (progress / 100);
      const gust = wind.update(dt, difficultyScale);
      currentGust = gust;
      const windAX = gust.dx * WIND_PARTICLE_FORCE;
      const windAY = gust.dy * WIND_PARTICLE_FORCE;
      particles.update(dt, progress, windAX, windAY);

      const emberDropped = stability.update(
        dt,
        gust,
        pointerOffsetX,
        pointerOffsetY,
        hasPointerControl,
      );
      updateWindHud(el, gust.angle, gust.strength, stability.value);
      if (emberDropped) {
        releaseHold();
      } else {
        emberBrightness = emberBrightnessForProgress(progress);
        pulseStrength = getStageWeights(progress).bud;
        updateStageIndicator(el.stageDots, progress);
        if (progress >= 100) finishNaturally(emberBrightness);
      }
    } else if (phase === 'misfiring' || phase === 'naturalEnding') {
      transitionTimer += dt;
      particles.decay(dt, progress);
      const duration = phase === 'misfiring' ? MISFIRE_DURATION : NATURAL_END_DURATION;
      const t = Math.min(1, transitionTimer / duration);
      emberBrightness = brightnessAtTransition * (1 - t);
      if (t >= 1) enterResult();
    } else if (phase === 'result') {
      particles.decay(dt, progress);
      emberBrightness = 0;
      showStick = false;
    }

    renderer.renderFrame(
      dt,
      particles.particles,
      emberBrightness,
      pulseStrength,
      showStick,
      currentGust,
    );
    requestAnimationFrame(frame);
  }

  syncGeometry();
  window.addEventListener('resize', syncGeometry);
  window.addEventListener('orientationchange', syncGeometry);

  bindHoldInput(el.pressZone, {
    onHoldStart: startBurning,
    onHoldEnd: releaseHold,
    onMove: (offsetX, offsetY) => {
      hasPointerControl = true;
      pointerOffsetX = offsetX;
      pointerOffsetY = offsetY;
    },
  });

  el.saveButton.addEventListener('click', handleSaveClick);
  el.retryButton.addEventListener('click', resetSimulation);
  el.iosCloseButton.addEventListener('click', closeIosFallback);

  showAffordance();
  showIntroIfFirstVisit();
  requestAnimationFrame(frame);
}

init();
