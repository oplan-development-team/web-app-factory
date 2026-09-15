import './style.css';
import { SoundEngine } from './audio.ts';
import { DustBurst } from './particles.ts';
import { getBestMs, setBestMsIfBetter } from './storage.ts';

type PlayerId = 'p1' | 'p2';
type Phase = 'idle' | 'ready' | 'draw' | 'flying' | 'win';

const WIN_SCORE = 3;
const READY_MIN_MS = 1500;
const READY_MAX_MS = 4500;
const RESULT_HOLD_MS = 1500;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('root element missing');

app.innerHTML = `
  <div class="portrait-guard" role="alert">
    <div class="portrait-guard__icon" aria-hidden="true"></div>
    <p class="portrait-guard__text">横向きにしてください</p>
    <p class="portrait-guard__sub">Quick Draw Duelは1台の端末を挟んだ対面2人プレイ専用です。端末を横向きに構えてください。</p>
  </div>

  <section class="screen screen--title" id="titleScreen">
    <div class="title-wrap">
      <h1 class="title-logo">QUICK<br>DRAW<br>DUEL</h1>
      <div class="title-rules">
        <div class="rule-card rule-card--p1">
          <span class="rule-card__player">P1</span>
          <span class="rule-card__zone">画面左半分をタップ</span>
          <span class="rule-card__key">SPACE</span>
        </div>
        <div class="rule-vs">VS</div>
        <div class="rule-card rule-card--p2">
          <span class="rule-card__player">P2</span>
          <span class="rule-card__zone">画面右半分をタップ</span>
          <span class="rule-card__key">ENTER</span>
        </div>
      </div>
      <ol class="title-howto">
        <li>黄色い「READY」の間はまだ押すな。フライングは即敗北。</li>
        <li>「DRAW!」の合図が出たら誰よりも早く反応しろ。</li>
        <li>3本先取したデュエリストが勝者。</li>
      </ol>
      <div class="title-actions">
        <button class="btn btn--primary btn--start" id="startBtn" type="button">対戦開始</button>
        <div class="title-best">
          <span class="title-best__label">全体ベスト反応速度</span>
          <span class="title-best__value" id="titleBestValue">記録なし</span>
        </div>
      </div>
    </div>
  </section>

  <section class="screen screen--arena" id="arenaScreen" hidden>
    <header class="scoreboard">
      <button class="btn btn--ghost btn--back" id="backBtn" type="button">&larr; タイトル</button>
      <div class="scoreboard__scores">
        <span class="scoreboard__tag">P1</span>
        <span class="scoreboard__score" id="scoreP1">0</span>
        <span class="scoreboard__sep">&mdash;</span>
        <span class="scoreboard__score" id="scoreP2">0</span>
        <span class="scoreboard__tag">P2</span>
      </div>
      <div class="scoreboard__best" id="bestChip">
        <span class="scoreboard__best-label">BEST</span>
        <span class="scoreboard__best-value" id="bestValue">記録なし</span>
      </div>
    </header>

    <div class="arena" id="arenaBody">
      <div class="zone zone--p1" id="zoneP1">
        <div class="zone__hint">SPACE / タップ</div>
        <div class="zone__label">P1</div>
        <div class="zone__stamp" id="stampP1"><span>BANG</span></div>
      </div>
      <div class="divider" aria-hidden="true">
        <div class="divider__glow"></div>
        <div class="divider__crack"></div>
      </div>
      <div class="zone zone--p2" id="zoneP2">
        <div class="zone__hint">ENTER / タップ</div>
        <div class="zone__label">P2</div>
        <div class="zone__stamp" id="stampP2"><span>BANG</span></div>
      </div>

      <canvas class="fx-canvas" id="fxCanvas"></canvas>

      <div class="overlay" id="overlayText">
        <span class="overlay__main" id="overlayMain" aria-live="assertive"></span>
        <span class="overlay__sub" id="overlaySub"></span>
        <span class="overlay__record-badge" id="recordBadge">NEW RECORD!</span>
      </div>
    </div>

    <div class="match-over" id="matchOver" hidden>
      <div class="match-over__inner">
        <p class="match-over__label">WINNER</p>
        <h2 class="match-over__winner" id="matchOverWinner">P1</h2>
        <p class="match-over__score" id="matchOverScore">3 &mdash; 1</p>
        <p class="match-over__best">今回のベストタイム: <span id="matchOverBest">&mdash;</span></p>
        <div class="match-over__actions">
          <button class="btn btn--primary" id="rematchBtn" type="button">リマッチ</button>
          <button class="btn btn--ghost" id="titleBtn2" type="button">タイトルへ戻る</button>
        </div>
      </div>
    </div>
  </section>

  <div class="flash" id="flashLayer" aria-hidden="true"></div>
`;

const $ = <T extends Element>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as unknown as T;
};

const titleScreen = $<HTMLElement>('titleScreen');
const arenaScreen = $<HTMLElement>('arenaScreen');
const startBtn = $<HTMLButtonElement>('startBtn');
const backBtn = $<HTMLButtonElement>('backBtn');
const titleBtn2 = $<HTMLButtonElement>('titleBtn2');
const rematchBtn = $<HTMLButtonElement>('rematchBtn');
const titleBestValue = $<HTMLElement>('titleBestValue');
const bestChip = $<HTMLElement>('bestChip');
const bestValue = $<HTMLElement>('bestValue');
const scoreP1El = $<HTMLElement>('scoreP1');
const scoreP2El = $<HTMLElement>('scoreP2');
const zoneP1 = $<HTMLElement>('zoneP1');
const zoneP2 = $<HTMLElement>('zoneP2');
const arenaBody = $<HTMLElement>('arenaBody');
const overlayMain = $<HTMLElement>('overlayMain');
const overlaySub = $<HTMLElement>('overlaySub');
const recordBadge = $<HTMLElement>('recordBadge');
const flashLayer = $<HTMLElement>('flashLayer');
const matchOver = $<HTMLElement>('matchOver');
const matchOverWinner = $<HTMLElement>('matchOverWinner');
const matchOverScore = $<HTMLElement>('matchOverScore');
const matchOverBest = $<HTMLElement>('matchOverBest');
const fxCanvas = $<HTMLCanvasElement>('fxCanvas');

const sound = new SoundEngine();
const dust = new DustBurst(fxCanvas);
window.addEventListener('resize', () => dust.resize());

function formatMs(ms: number | null): string {
  return ms === null ? '記録なし' : `${Math.round(ms)}ms`;
}

function refreshBestDisplays(): void {
  const best = getBestMs();
  titleBestValue.textContent = formatMs(best);
  titleBestValue.classList.toggle('has-record', best !== null);
  bestValue.textContent = formatMs(best);
}

refreshBestDisplays();

// ---------------------------------------------------------------------
// Match / round state
// ---------------------------------------------------------------------
let scores: Record<PlayerId, number> = { p1: 0, p2: 0 };
let matchBestMs: number | null = null;
let phase: Phase = 'idle';
let drawAt = 0;
let readyTimer = 0;
let advanceTimer = 0;
let roundResolved = false;

function opponentOf(p: PlayerId): PlayerId {
  return p === 'p1' ? 'p2' : 'p1';
}

function clearTimers(): void {
  window.clearTimeout(readyTimer);
  window.clearTimeout(advanceTimer);
}

function updateScoreboard(): void {
  scoreP1El.textContent = String(scores.p1);
  scoreP2El.textContent = String(scores.p2);
  scoreP1El.classList.toggle('is-leading', scores.p1 > scores.p2);
  scoreP2El.classList.toggle('is-leading', scores.p2 > scores.p1);
}

function setArenaPhaseClass(p: Phase): void {
  arenaBody.classList.remove('phase-ready', 'phase-draw', 'phase-flying', 'phase-win');
  if (p === 'ready') arenaBody.classList.add('phase-ready');
  if (p === 'draw') arenaBody.classList.add('phase-draw');
  if (p === 'flying') arenaBody.classList.add('phase-flying');
  if (p === 'win') arenaBody.classList.add('phase-win');
}

function resetStamps(): void {
  zoneP1.querySelector('.zone__stamp')?.classList.remove('is-visible');
  zoneP2.querySelector('.zone__stamp')?.classList.remove('is-visible');
}

function startMatch(): void {
  sound.unlock();
  scores = { p1: 0, p2: 0 };
  matchBestMs = null;
  matchOver.hidden = true;
  updateScoreboard();
  titleScreen.hidden = true;
  arenaScreen.hidden = false;
  requestAnimationFrame(() => dust.resize());
  beginRound();
}

function beginRound(): void {
  clearTimers();
  resetStamps();
  roundResolved = false;
  phase = 'ready';
  setArenaPhaseClass('ready');
  overlayMain.textContent = 'READY';
  overlaySub.textContent = 'まだ押すな';
  recordBadge.classList.remove('is-visible');

  const delay = READY_MIN_MS + Math.random() * (READY_MAX_MS - READY_MIN_MS);
  readyTimer = window.setTimeout(() => {
    phase = 'draw';
    setArenaPhaseClass('draw');
    overlayMain.textContent = 'DRAW!';
    overlaySub.textContent = '';
    drawAt = performance.now();
    sound.playGong();
  }, delay);
}

function scheduleNextStep(matchJustEnded: boolean): void {
  advanceTimer = window.setTimeout(() => {
    if (matchJustEnded) {
      showMatchOver();
    } else {
      beginRound();
    }
  }, RESULT_HOLD_MS);
}

function handleFlying(player: PlayerId): void {
  if (roundResolved || phase !== 'ready') return;
  roundResolved = true;
  clearTimers();
  phase = 'flying';
  setArenaPhaseClass('flying');

  const winner = opponentOf(player);
  scores[winner] += 1;
  updateScoreboard();

  overlayMain.textContent = 'BANG';
  overlaySub.textContent = `${player.toUpperCase()} フライング！ ${winner.toUpperCase()} の勝ち`;

  const stampEl = (player === 'p1' ? zoneP1 : zoneP2).querySelector('.zone__stamp');
  stampEl?.classList.add('is-visible');

  sound.playGunshot('flying');
  flashLayer.classList.remove('is-active');
  arenaBody.classList.remove('is-shaking');
  // Force reflow so the animation can be re-triggered on consecutive fouls.
  void flashLayer.offsetWidth;
  flashLayer.classList.add('is-active');
  arenaBody.classList.add('is-shaking');

  const matchEnded = scores[winner] >= WIN_SCORE;
  scheduleNextStep(matchEnded);
}

function handleReact(player: PlayerId): void {
  if (roundResolved || phase !== 'draw') return;
  roundResolved = true;
  clearTimers();
  phase = 'win';
  setArenaPhaseClass('win');

  const reactionMs = performance.now() - drawAt;
  scores[player] += 1;
  updateScoreboard();

  if (matchBestMs === null || reactionMs < matchBestMs) {
    matchBestMs = reactionMs;
  }
  const isNewRecord = setBestMsIfBetter(reactionMs);
  refreshBestDisplays();

  overlayMain.textContent = `${Math.round(reactionMs)}ms`;
  overlaySub.textContent = `${player.toUpperCase()} の勝ち！`;

  if (isNewRecord) {
    recordBadge.classList.add('is-visible');
    bestChip.classList.remove('is-record');
    void bestChip.offsetWidth;
    bestChip.classList.add('is-record');
    sound.playRecord();
  }

  sound.playGunshot('win');
  const xRatio = player === 'p1' ? 0.25 : 0.75;
  dust.burst(xRatio, 0.55, isNewRecord ? 'blood' : 'bone');

  const matchEnded = scores[player] >= WIN_SCORE;
  scheduleNextStep(matchEnded);
}

function showMatchOver(): void {
  const winner: PlayerId = scores.p1 >= WIN_SCORE ? 'p1' : 'p2';
  matchOverWinner.textContent = winner.toUpperCase();
  matchOverScore.textContent = `${scores.p1} — ${scores.p2}`;
  matchOverBest.textContent = formatMs(matchBestMs);
  matchOver.hidden = false;
  phase = 'idle';
  setArenaPhaseClass('idle');
}

function returnToTitle(): void {
  clearTimers();
  phase = 'idle';
  matchOver.hidden = true;
  arenaScreen.hidden = true;
  titleScreen.hidden = false;
  refreshBestDisplays();
}

// ---------------------------------------------------------------------
// Input wiring — keyboard (Space/Enter) and pointer (left/right tap)
// ---------------------------------------------------------------------
function registerInput(player: PlayerId): void {
  if (phase === 'ready') {
    handleFlying(player);
  } else if (phase === 'draw') {
    handleReact(player);
  }
}

window.addEventListener('keydown', (e) => {
  if (arenaScreen.hidden) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat) registerInput('p1');
  } else if (e.code === 'Enter') {
    e.preventDefault();
    if (!e.repeat) registerInput('p2');
  }
});

zoneP1.addEventListener('pointerdown', () => registerInput('p1'));
zoneP2.addEventListener('pointerdown', () => registerInput('p2'));

startBtn.addEventListener('click', startMatch);
rematchBtn.addEventListener('click', () => {
  sound.unlock();
  scores = { p1: 0, p2: 0 };
  matchBestMs = null;
  matchOver.hidden = true;
  updateScoreboard();
  beginRound();
});
backBtn.addEventListener('click', returnToTitle);
titleBtn2.addEventListener('click', returnToTitle);
