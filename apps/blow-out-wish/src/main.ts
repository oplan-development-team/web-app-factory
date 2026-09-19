import './style.css';
import { AudioEngine, AudioEngineError } from './audio';
import { Scene } from './scene';
import type { CalibrationResult, MicErrorKind, ModeConfig, Screen, SoloCount } from './types';

// ---------------------------------------------------------------------------
// constants
// ---------------------------------------------------------------------------

const CALIBRATION_MS = 2000;
const SUSTAIN_MS = 300; // how long RMS must stay above threshold to count as a "blow"
const CHALLENGE_INITIAL_TIME = 20; // seconds
const CHALLENGE_TIME_BONUS = 5; // seconds granted per cleared round
const DEFAULT_HINT = 'マイクに向かって、ふーっと吹いてください';

const CALIBRATION_RING_CIRC = 2 * Math.PI * 52;
const BREATH_RING_CIRC = 2 * Math.PI * 46;

const ERROR_CONTENT: Record<MicErrorKind, { title: string; body: string; steps: string[] }> = {
  denied: {
    title: 'マイクの許可がブロックされています',
    body: 'ブラウザがこのサイトのマイク使用をブロックしています。アドレスバーの鍵(またはカメラ)アイコンから、手動で許可に変更してください。',
    steps: [
      'アドレスバー左側の鍵マーク(またはカメラ/マイクのアイコン)をクリックする',
      '「マイク」の項目を「許可」に変更する',
      '下の「ページを再読み込み」を押す',
    ],
  },
  device: {
    title: 'マイクを使用できません',
    body: '他のビデオ通話アプリ(Zoom、Google Meetなど)がマイクを占有しているか、マイクが認識されていない可能性があります。',
    steps: [
      'ビデオ通話中の他のアプリ・ブラウザタブを終了する',
      'マイクが正しく接続されているか確認する',
      '「もう一度試す」を押す',
    ],
  },
  unknown: {
    title: 'マイクを開始できませんでした',
    body: '予期しないエラーが発生しました。ブラウザやデバイスの設定を確認して、もう一度お試しください。',
    steps: ['ページを再読み込みしてから、もう一度試す', '別のブラウザ(最新のChrome/Edge/Safari)で試す'],
  },
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function el<T extends Element = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing element #${id}`);
  return found as unknown as T;
}

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

const screens: Record<Screen, HTMLElement> = {
  onboarding: el('screen-onboarding'),
  calibrating: el('screen-calibrating'),
  'mic-error': el('screen-mic-error'),
  'mode-select': el('screen-mode-select'),
  game: el('screen-game'),
  wish: el('screen-wish'),
  timeup: el('screen-timeup'),
};

const btnRequestMic = el<HTMLButtonElement>('btn-request-mic');
const calibratingRingFill = el<SVGCircleElement>('calibrating-ring__fill');

const micErrorTitle = el('mic-error-title');
const micErrorBody = el('mic-error-body');
const micErrorSteps = el<HTMLOListElement>('mic-error-steps');
const btnRetryMic = el<HTMLButtonElement>('btn-retry-mic');
const btnReload = el<HTMLButtonElement>('btn-reload');

const presetPills = Array.from(document.querySelectorAll<HTMLButtonElement>('.preset-pill'));
const btnStartChallenge = el<HTMLButtonElement>('btn-start-challenge');

const btnBackToModes = el<HTMLButtonElement>('btn-back-to-modes');
const gameModeLabel = el('game-mode-label');
const gameTimer = el('game-timer');
const sceneCanvas = el<HTMLCanvasElement>('scene-canvas');
const sceneWrap = sceneCanvas.parentElement as HTMLElement;
const breathDialFill = el<SVGCircleElement>('breath-dial__fill');
const breathDial = document.querySelector<HTMLElement>('.breath-dial')!;
const breathHintEl = el('breath-hint');

const wishScreenEl = el('screen-wish');
const wishForm = el<HTMLFormElement>('wish-form');
const wishTextInput = el<HTMLInputElement>('wish-text');
const wishRevealText = el('wish-reveal-text');
const btnRelight = el<HTMLButtonElement>('btn-relight');
const btnWishBackToModes = el<HTMLButtonElement>('btn-wish-back-to-modes');

const timeupCount = el('timeup-count');
const btnRetryChallenge = el<HTMLButtonElement>('btn-retry-challenge');
const btnTimeupBackToModes = el<HTMLButtonElement>('btn-timeup-back-to-modes');

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------

const simulate = new URLSearchParams(location.search).get('simulate') === '1';
const audio = new AudioEngine(simulate);
const scene = new Scene(sceneCanvas, sceneWrap);

let currentScreen: Screen = 'onboarding';
let calibration: CalibrationResult | null = null;
let modeConfig: ModeConfig | null = null;
let challengeLevel = 1;
let challengeTimeLeft = CHALLENGE_INITIAL_TIME;
let micRequestInFlight = false;

let gameLoopRaf = 0;
let lastGameLoopTime = 0;
let blowStreakStart: number | null = null;
let blowPeakRatio = 0;
let hintTimeoutId: number | undefined;

scene.onAllExtinguished = () => handleRoundCleared();

// ---------------------------------------------------------------------------
// screen management
// ---------------------------------------------------------------------------

function showScreen(name: Screen): void {
  currentScreen = name;
  (Object.keys(screens) as Screen[]).forEach((key) => {
    screens[key].hidden = key !== name;
  });
}

// ---------------------------------------------------------------------------
// onboarding -> calibration -> mode select
// ---------------------------------------------------------------------------

async function requestMicAndCalibrate(): Promise<void> {
  if (micRequestInFlight) return;
  micRequestInFlight = true;
  showScreen('calibrating');
  setCalibrationRing(0);
  try {
    await audio.start();
    const result = await audio.calibrate(CALIBRATION_MS, setCalibrationRing);
    calibration = result;
    showScreen('mode-select');
  } catch (err) {
    showMicError(err);
  } finally {
    micRequestInFlight = false;
  }
}

function setCalibrationRing(ratio: number): void {
  calibratingRingFill.style.strokeDashoffset = String(CALIBRATION_RING_CIRC * (1 - clamp(ratio, 0, 1)));
}

function showMicError(err: unknown): void {
  const kind: MicErrorKind = err instanceof AudioEngineError ? err.kind : 'unknown';
  const content = ERROR_CONTENT[kind];
  micErrorTitle.textContent = content.title;
  micErrorBody.textContent = content.body;
  micErrorSteps.replaceChildren(
    ...content.steps.map((step) => {
      const li = document.createElement('li');
      li.textContent = step;
      return li;
    }),
  );
  showScreen('mic-error');
}

btnRequestMic.addEventListener('click', requestMicAndCalibrate);
btnRetryMic.addEventListener('click', requestMicAndCalibrate);
btnReload.addEventListener('click', () => location.reload());

// ---------------------------------------------------------------------------
// mode select
// ---------------------------------------------------------------------------

function goToModeSelect(): void {
  stopGameLoop();
  scene.stop();
  showScreen('mode-select');
}

function startSolo(count: SoloCount): void {
  modeConfig = { kind: 'solo', count };
  beginGameRound(count);
  updateGameHeader();
  showScreen('game');
}

function startChallenge(): void {
  modeConfig = { kind: 'challenge' };
  challengeLevel = 1;
  challengeTimeLeft = CHALLENGE_INITIAL_TIME;
  beginGameRound(challengeLevel);
  updateGameHeader();
  showScreen('game');
}

presetPills.forEach((btn) => {
  btn.addEventListener('click', () => {
    const count = Number(btn.dataset.count) as SoloCount;
    startSolo(count);
  });
});
btnStartChallenge.addEventListener('click', startChallenge);
btnBackToModes.addEventListener('click', goToModeSelect);
btnWishBackToModes.addEventListener('click', goToModeSelect);
btnTimeupBackToModes.addEventListener('click', goToModeSelect);

// ---------------------------------------------------------------------------
// game
// ---------------------------------------------------------------------------

function beginGameRound(count: number): void {
  scene.startRound(count);
  scene.start();
  blowStreakStart = null;
  blowPeakRatio = 0;
  setHint(DEFAULT_HINT);
  startGameLoop();
}

function updateGameHeader(): void {
  if (!modeConfig) return;
  if (modeConfig.kind === 'solo') {
    gameModeLabel.textContent = `ソロモード ・ ${modeConfig.count}本`;
    gameTimer.hidden = true;
  } else {
    gameModeLabel.textContent = `連続チャレンジ ・ LEVEL ${challengeLevel}`;
    gameTimer.hidden = false;
    updateGameTimerDisplay();
  }
}

function updateGameTimerDisplay(): void {
  const secs = Math.max(0, Math.ceil(challengeTimeLeft));
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  gameTimer.textContent = `${mm}:${ss}`;
  gameTimer.classList.toggle('is-urgent', secs <= 5);
}

function setHint(text: string, temporary = false): void {
  breathHintEl.textContent = text;
  if (temporary) {
    window.clearTimeout(hintTimeoutId);
    hintTimeoutId = window.setTimeout(() => {
      breathHintEl.textContent = DEFAULT_HINT;
    }, 1100);
  }
}

function startGameLoop(): void {
  stopGameLoop();
  lastGameLoopTime = performance.now();
  gameLoopRaf = requestAnimationFrame(gameLoop);
}

function stopGameLoop(): void {
  if (gameLoopRaf) cancelAnimationFrame(gameLoopRaf);
  gameLoopRaf = 0;
}

function gameLoop(): void {
  if (currentScreen !== 'game') return;
  const now = performance.now();
  const dt = clamp((now - lastGameLoopTime) / 1000, 0, 0.1);
  lastGameLoopTime = now;

  const rms = audio.getRms();
  const ratio = calibration ? rms / calibration.threshold : 0;
  scene.setBreath(ratio);
  updateBreathGauge(ratio);
  handleBlowDetection(ratio, now);

  if (modeConfig?.kind === 'challenge') {
    challengeTimeLeft -= dt;
    updateGameTimerDisplay();
    if (challengeTimeLeft <= 0) {
      goToTimeup();
      return;
    }
  }

  gameLoopRaf = requestAnimationFrame(gameLoop);
}

function updateBreathGauge(ratio: number): void {
  const displayRatio = clamp(ratio / 1.4, 0, 1);
  breathDialFill.style.strokeDashoffset = String(BREATH_RING_CIRC * (1 - displayRatio));
  breathDial.classList.toggle('is-near', ratio >= 0.65 && ratio < 1);
  breathDial.classList.toggle('is-active', ratio >= 1);
}

function handleBlowDetection(ratio: number, now: number): void {
  if (ratio >= 1) {
    if (blowStreakStart === null) blowStreakStart = now;
    blowPeakRatio = Math.max(blowPeakRatio, ratio);
    const streakMs = now - blowStreakStart;
    if (streakMs >= SUSTAIN_MS) {
      const sustainBonus = (streakMs - SUSTAIN_MS) / 260;
      const strength = blowPeakRatio - 1 + sustainBonus;
      const count = clamp(1 + Math.floor(strength), 1, Math.max(1, scene.litCount));
      const extinguished = scene.extinguishBurst(count);
      if (extinguished > 0) {
        setHint(extinguished > 1 ? `${extinguished}本まとめて消えた!` : '消えた!', true);
      }
      blowStreakStart = now;
      blowPeakRatio = ratio;
    }
  } else {
    blowStreakStart = null;
    blowPeakRatio = 0;
  }
}

function handleRoundCleared(): void {
  if (!modeConfig) return;
  if (modeConfig.kind === 'solo') {
    stopGameLoop();
    scene.stop();
    goToWishInput();
  } else {
    challengeLevel += 1;
    challengeTimeLeft = challengeTimeLeft + CHALLENGE_TIME_BONUS;
    beginGameRound(challengeLevel);
    updateGameHeader();
    setHint(`LEVEL ${challengeLevel}!`, true);
  }
}

function goToTimeup(): void {
  stopGameLoop();
  scene.stop();
  const reached = Math.max(0, challengeLevel - 1);
  timeupCount.textContent = String(reached);
  showScreen('timeup');
}

btnRetryChallenge.addEventListener('click', startChallenge);

// ---------------------------------------------------------------------------
// wish input + reveal
// ---------------------------------------------------------------------------

function goToWishInput(): void {
  wishScreenEl.dataset.phase = 'input';
  wishTextInput.value = '';
  showScreen('wish');
  window.setTimeout(() => wishTextInput.focus(), 50);
}

wishForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const raw = wishTextInput.value.trim();
  const text = raw.length > 0 ? raw : '……';
  wishRevealText.textContent = text;
  wishScreenEl.dataset.phase = 'reveal';
});

btnRelight.addEventListener('click', () => {
  if (!modeConfig) return;
  if (modeConfig.kind === 'solo') {
    beginGameRound(modeConfig.count);
  } else {
    challengeLevel = 1;
    challengeTimeLeft = CHALLENGE_INITIAL_TIME;
    beginGameRound(challengeLevel);
  }
  updateGameHeader();
  showScreen('game');
});

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------

showScreen('onboarding');
