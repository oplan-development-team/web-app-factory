import './style.css';
import { PointerTracker } from './pointer';
import { BoardTransform, VIRTUAL_W, VIRTUAL_H, TORII_ZONE_ID, SAYONARA_ZONE_ID } from './board';
import { SeanceEngine } from './session';
import { createWashiTexture } from './texture';
import { SmokeTrail } from './trail';
import { render } from './renderer';
import { renderCharm, downloadCanvasAsPng, ensureCharmFontsReady } from './charm';
import { buildSettingsPanel, renderLogList } from './ui';
import type { LogEntry, Vec2 } from './types';

const app = document.getElementById('app')!;

app.innerHTML = `
  <header class="masthead">
    <h1 class="title">指先の集会</h1>
    <p class="subtitle">コイン・セアンス — デジタル・コックリさん実験ノート</p>
  </header>

  <div class="layout">
    <div class="dock dock-left">
      <button class="tab" id="tabSettings" aria-expanded="false">設　定</button>
      <aside class="panel" id="settingsPanel"><div class="panel-inner" id="settingsInner"></div></aside>
    </div>

    <main class="stage-wrap">
      <div class="stage" id="stage">
        <canvas id="board"></canvas>

        <div class="finger-indicator" id="fingerIndicator">
          <span class="dots" id="fingerDots"></span>
          <span id="fingerLabel">指 0 本</span>
        </div>

        <div class="mobile-banner" id="mobileBanner"></div>

        <div class="overlay show" id="setupOverlay">
          <div class="ritual-card">
            <h2>問いをひとつ、静かに</h2>
            <p class="lead">心を鎮め、今宵の問いをひとつだけ定めてください。<br />入力を終えるまで、盤面への接触は無効になります。</p>
            <input type="text" id="questionInput" maxlength="60" placeholder="例）今日、良いことはありますか" autocomplete="off" />
            <div class="btn-row">
              <button class="btn primary" id="startButton">はじめる</button>
            </div>
          </div>
        </div>

        <div class="landed-hud" id="landedHud">
          <span class="landed-seq" id="landedSeq"></span>
          <button class="btn ghost" id="continueButton" title="指を一度離してから置き直しても続けられます">続ける</button>
          <button class="btn" id="finishButton">終了する</button>
        </div>

        <div class="overlay" id="endOverlay">
          <div class="ritual-card">
            <h2 id="endTitle">さようなら</h2>
            <p class="lead" id="endQuestion"></p>
            <div class="sequence-display" id="endSequence"></div>
            <div class="btn-row">
              <button class="btn" id="charmButton">怪談札を書き出す</button>
              <button class="btn primary" id="newSessionButton">新しいセッションへ</button>
            </div>
          </div>
        </div>
      </div>
      <p class="phase-hint" id="phaseHint">問いを入力してください</p>
    </main>

    <div class="dock dock-right">
      <aside class="panel" id="logPanel"><div class="panel-inner" id="logInner"></div></aside>
      <button class="tab" id="tabLog" aria-expanded="false">記　録</button>
    </div>
  </div>

  <div class="modal" id="charmModal">
    <div class="modal-content">
      <div id="charmPreviewWrap"></div>
      <div class="btn-row">
        <button class="btn ghost" id="charmCloseButton">閉じる</button>
        <button class="btn primary" id="charmDownloadButton">PNGをダウンロード</button>
      </div>
    </div>
  </div>
`;

// ---------- 要素取得 ----------

const stage = document.getElementById('stage')!;
const canvas = document.getElementById('board') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const fingerDots = document.getElementById('fingerDots')!;
const fingerLabel = document.getElementById('fingerLabel')!;
const mobileBanner = document.getElementById('mobileBanner')!;
const setupOverlay = document.getElementById('setupOverlay')!;
const questionInput = document.getElementById('questionInput') as HTMLInputElement;
const startButton = document.getElementById('startButton')!;
const landedHud = document.getElementById('landedHud')!;
const landedSeq = document.getElementById('landedSeq')!;
const continueButton = document.getElementById('continueButton')!;
const finishButton = document.getElementById('finishButton')!;
const endOverlay = document.getElementById('endOverlay')!;
const endTitle = document.getElementById('endTitle')!;
const endQuestion = document.getElementById('endQuestion')!;
const endSequence = document.getElementById('endSequence')!;
const charmButton = document.getElementById('charmButton')!;
const newSessionButton = document.getElementById('newSessionButton')!;
const phaseHint = document.getElementById('phaseHint')!;
const charmModal = document.getElementById('charmModal')!;
const charmPreviewWrap = document.getElementById('charmPreviewWrap')!;
const charmCloseButton = document.getElementById('charmCloseButton')!;
const charmDownloadButton = document.getElementById('charmDownloadButton')!;

const tabSettings = document.getElementById('tabSettings') as HTMLButtonElement;
const tabLog = document.getElementById('tabLog') as HTMLButtonElement;
const settingsPanel = document.getElementById('settingsPanel')!;
const logPanel = document.getElementById('logPanel')!;
const settingsInner = document.getElementById('settingsInner')!;
const logInner = document.getElementById('logInner')!;

// ---------- 状態 ----------

const logEntries: LogEntry[] = [];
let pendingCharmData: { question: string; sequence: string; startedAt: number; endedAt: number } | null = null;

const engine = new SeanceEngine({
  onPhaseChange: (phase) => {
    updatePhaseHint(phase);
    if (phase === 'landed') showLandedHud();
    else hideLandedHud();
  },
  onLog: (entry) => {
    logEntries.push(entry);
    renderLogList(logInner, logEntries);
    showEndOverlay(entry);
  },
});

const transform = new BoardTransform();
const trail = new SmokeTrail();
const texture = createWashiTexture(VIRTUAL_W - 8, VIRTUAL_H - 8, 7);

// ---------- ポインタ管理 ----------

const tracker = new PointerTracker(canvas, {
  onChange: (count) => updateFingerIndicator(count),
});
tracker.setEnabled(false); // setup フェーズでは無効

function updateFingerIndicator(count: number): void {
  fingerLabel.textContent = `指 ${count} 本`;
  const dotCount = Math.min(count, 6);
  fingerDots.innerHTML = '';
  for (let i = 0; i < Math.max(dotCount, 1); i++) {
    const dot = document.createElement('span');
    dot.className = 'dot' + (i < count ? ' on' : '');
    fingerDots.appendChild(dot);
  }
}
updateFingerIndicator(0);

// ---------- キャンバスのリサイズ（ビューポート追従スケーリング） ----------

function resizeCanvas(): void {
  const rect = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  transform.resize(rect.width, rect.height);
  (canvas as unknown as { __dpr: number }).__dpr = dpr;
  updateMobileBanner(rect.width, rect.height);
}

function updateMobileBanner(width: number, height: number): void {
  const kanaOnScreenDiameter = transform.onScreenDiameter(26);
  const isPortraitNarrow = height > width && width < 700;
  const capacityEstimate = Math.max(1, Math.min(6, Math.floor(width / 170)));

  if (kanaOnScreenDiameter < 44 || isPortraitNarrow) {
    mobileBanner.textContent = `画面が小さいため横向き表示を推奨します。目安として同時に指を置けるのは約${capacityEstimate}人までです。`;
    mobileBanner.classList.add('show');
  } else {
    mobileBanner.classList.remove('show');
  }
}

const resizeObserver = new ResizeObserver(() => resizeCanvas());
resizeObserver.observe(stage);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 200));
resizeCanvas();

// ---------- 設定パネル / ログパネル ----------

buildSettingsPanel(settingsInner, engine.settings, () => {
  /* engine.settings はスライダーが直接ミューテートするため、追加処理は不要 */
});
renderLogList(logInner, logEntries);

function togglePanel(panel: HTMLElement, tab: HTMLButtonElement, otherPanel: HTMLElement, otherTab: HTMLButtonElement): void {
  const willOpen = !panel.classList.contains('open');
  panel.classList.toggle('open', willOpen);
  tab.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) {
    otherPanel.classList.remove('open');
    otherTab.setAttribute('aria-expanded', 'false');
  }
  // レイアウトが変わるのでキャンバスを再フィットする
  requestAnimationFrame(resizeCanvas);
}

tabSettings.addEventListener('click', () => togglePanel(settingsPanel, tabSettings, logPanel, tabLog));
tabLog.addEventListener('click', () => togglePanel(logPanel, tabLog, settingsPanel, tabSettings));

// ---------- 質問入力フェーズ ----------

function startSession(): void {
  const q = questionInput.value.trim();
  questionInput.blur();
  setupOverlay.classList.remove('show');
  tracker.setEnabled(true);
  engine.startRound(q);
}

startButton.addEventListener('click', startSession);
questionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startSession();
});

// ---------- 着地 HUD ----------

function showLandedHud(): void {
  landedSeq.textContent = engine.sequence.join('') || '　';
  landedHud.classList.add('show');
}

function hideLandedHud(): void {
  landedHud.classList.remove('show');
}

continueButton.addEventListener('click', () => engine.continueRound());
finishButton.addEventListener('click', () => engine.endManually());

// ---------- セッション終了 UI ----------

function showEndOverlay(entry: LogEntry): void {
  pendingCharmData = { question: entry.question, sequence: entry.sequence, startedAt: entry.startedAt, endedAt: entry.endedAt };
  const landedTorii = engine.landedZoneId === TORII_ZONE_ID;
  const landedSayonara = engine.landedZoneId === SAYONARA_ZONE_ID;
  endTitle.textContent = landedTorii ? '鳥居へ還る' : landedSayonara ? 'さようなら' : 'セッション終了';
  endQuestion.textContent = `問い　${entry.question || '（無題の問い）'}`;
  endSequence.textContent = entry.sequence || '（無回答）';
  endOverlay.classList.add('show');
}

newSessionButton.addEventListener('click', () => {
  endOverlay.classList.remove('show');
  tracker.setEnabled(false);
  setupOverlay.classList.add('show');
  questionInput.value = '';
  engine.resetToSetup();
  requestAnimationFrame(() => questionInput.focus());
});

// ---------- 怪談札 ----------

charmButton.addEventListener('click', async () => {
  if (!pendingCharmData) return;
  const data = pendingCharmData;
  const originalLabel = charmButton.textContent;
  (charmButton as HTMLButtonElement).disabled = true;
  charmButton.textContent = '札を認めています…';
  try {
    // 札にしか登場しない漢字のフォントサブセットを描画前に読み込み切る
    await ensureCharmFontsReady(data.question, data.sequence);
  } finally {
    (charmButton as HTMLButtonElement).disabled = false;
    charmButton.textContent = originalLabel;
  }
  const canvasOut = renderCharm(data);
  charmPreviewWrap.innerHTML = '';
  charmPreviewWrap.appendChild(canvasOut);
  charmModal.classList.add('show');
});

charmCloseButton.addEventListener('click', () => charmModal.classList.remove('show'));

charmDownloadButton.addEventListener('click', () => {
  const c = charmPreviewWrap.querySelector('canvas');
  if (!c) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  downloadCanvasAsPng(c, `kaidan-fuda-${stamp}.png`);
});

// ---------- フェーズヒント ----------

function updatePhaseHint(phase: string): void {
  const map: Record<string, string> = {
    setup: '問いを入力してください',
    ready: '盤面に指を置いてください（複数人可）',
    engaged: '玉が指の重心に寄り添っています',
    drifting: '玉が自ら揺らぎはじめました…',
    landed: '玉が応えました。「続ける」を押すか、指を離してから置き直してください',
    ended: 'セッションが終わりました',
  };
  phaseHint.textContent = map[phase] ?? '';
}
updatePhaseHint('setup');

// ---------- メインループ ----------

let lastTime = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  const centroidPx = tracker.centroid();
  const centroidVirtual: Vec2 | null = centroidPx ? transform.toVirtual(centroidPx.x, centroidPx.y) : null;
  engine.update(dt, centroidVirtual, tracker.count);

  const prevCoin = { x: engine.coin.x, y: engine.coin.y };
  const moved = Math.hypot(engine.coin.x - prevCoin.x, engine.coin.y - prevCoin.y);
  trail.update(dt, engine.coin.x, engine.coin.y, moved || (engine.phase === 'drifting' ? 4 : 0));

  const dpr = (canvas as unknown as { __dpr?: number }).__dpr ?? 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#050403';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * transform.scale, 0, 0, dpr * transform.scale, dpr * transform.offsetX, dpr * transform.offsetY);

  const activeFingers: Vec2[] = [];
  if (centroidVirtual && tracker.count > 0) {
    // 個々の指位置までは公開していないため、重心のみを控えめな指標として描画する
    activeFingers.push(centroidVirtual);
  }

  render(ctx, texture, {
    zones: engine.zones,
    coinPos: engine.coin,
    activeFingers,
    landedZoneId: engine.landedZoneId,
    hintZoneId: engine.hintZoneId,
    phase: engine.phase,
    trail,
    boardAlpha: engine.phase === 'setup' ? 0.35 : 1,
  });

  requestAnimationFrame(frame);
}

requestAnimationFrame((t) => {
  lastTime = t;
  requestAnimationFrame(frame);
});

requestAnimationFrame(() => questionInput.focus());
