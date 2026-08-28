import { pickCaption } from './captions.js';

/* =============================================================================
   定数
   ============================================================================= */

const CANVAS_W = 1280;
const CANVAS_H = 720;
const LETTERBOX_RATIO = 0.115; // 上下黒帯の高さ（キャンバス高さに対する比率）
const TIMECODE_FPS = 24; // タイムコード表示用の疑似フレームレート（映画的な24fps）

const FADE_IN_MS = 350;
const HOLD_MS = 2200;
const FADE_OUT_MS = 550;
const GLOBAL_GAP_MS = 1200; // 字幕が消えてから次の字幕が出るまでの最短間隔（連発防止）

const SOUND_COOLDOWN_MS = 3500;
const MOTION_COOLDOWN_MS = 3500;
const SILENCE_COOLDOWN_MS = 7000;
const SILENCE_REQUIRED_QUIET_MS = 6000; // これだけ動きが無いと「沈黙/静止」トリガーの対象になる
const SILENCE_FLOOR = 1.5; // これ未満の変化量は「静止している」とみなす基準

const MOTION_SAMPLE_W = 48;
const MOTION_SAMPLE_H = 27;

/* =============================================================================
   DOM参照
   ============================================================================= */

const stageCanvas = document.getElementById('stage-canvas');
const ctx = stageCanvas.getContext('2d');
const video = document.getElementById('source-video');
const standby = document.getElementById('standby');
const startButton = document.getElementById('start-button');
const startError = document.getElementById('start-error');
const snapshotButton = document.getElementById('snapshot-button');
const clipButton = document.getElementById('clip-button');
const captureStatus = document.getElementById('capture-status');
const captionLive = document.getElementById('caption-live');

const soundSlider = document.getElementById('sound-sensitivity');
const motionSlider = document.getElementById('motion-sensitivity');
const soundValueEl = document.getElementById('sound-value');
const motionValueEl = document.getElementById('motion-value');
const soundMeter = document.getElementById('sound-meter');
const motionMeter = document.getElementById('motion-meter');

const moodButtons = Array.from(document.querySelectorAll('.mood-switch__btn'));
const cueButtons = Array.from(document.querySelectorAll('.btn--cue'));

/* =============================================================================
   状態
   ============================================================================= */

const state = {
  mood: 'suspense',
  soundSensitivity: 50,
  motionSensitivity: 50,
};

let hasStream = false;
let sessionStartTime = 0;
let micStream = null;
let isRecordingClip = false;
let frameCount = 0;

const captionState = { trigger: null, text: '', phase: 'idle', phaseStart: 0 };
let lastCaptionHiddenAt = -Infinity;
let soundCooldownUntil = 0;
let motionCooldownUntil = 0;
let silenceCooldownUntil = 0;
let silenceTimerStart = null;

/* =============================================================================
   オフスクリーン素材（グレイン・ビネット）を起動時に一度だけ生成
   ============================================================================= */

function buildNoiseTile(size) {
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 40 + Math.random() * 60;
  }
  tctx.putImageData(img, 0, 0);
  return tile;
}

const noiseTiles = Array.from({ length: 6 }, () => buildNoiseTile(200));
const noisePatterns = noiseTiles.map((tile) => ctx.createPattern(tile, 'repeat'));

const vignetteCanvas = document.createElement('canvas');
vignetteCanvas.width = CANVAS_W;
vignetteCanvas.height = CANVAS_H;
(function buildVignette() {
  const vctx = vignetteCanvas.getContext('2d');
  const gradient = vctx.createRadialGradient(
    CANVAS_W / 2,
    CANVAS_H / 2,
    CANVAS_H * 0.25,
    CANVAS_W / 2,
    CANVAS_H / 2,
    CANVAS_W * 0.62
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.65, 'rgba(0,0,0,0.08)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.62)');
  vctx.fillStyle = gradient;
  vctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
})();

const motionSampleCanvas = document.createElement('canvas');
motionSampleCanvas.width = MOTION_SAMPLE_W;
motionSampleCanvas.height = MOTION_SAMPLE_H;
const motionCtx = motionSampleCanvas.getContext('2d', { willReadFrequently: true });
let previousGray = null;

/* =============================================================================
   ユーティリティ
   ============================================================================= */

const pad2 = (n) => String(Math.max(0, Math.floor(n))).padStart(2, '0');
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;

function computeCoverRect(srcW, srcH, dstW, dstH) {
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  let sw = srcW;
  let sh = srcH;
  if (srcRatio > dstRatio) {
    sw = srcH * dstRatio;
  } else {
    sh = srcW / dstRatio;
  }
  const sx = (srcW - sw) / 2;
  const sy = (srcH - sh) / 2;
  return { sx, sy, sw, sh };
}

function timestampForFilename() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function showStatus(message) {
  captureStatus.textContent = message;
}

/* =============================================================================
   字幕（キャプション）ステートマシン
   ============================================================================= */

function showCaption(trigger) {
  const text = pickCaption(state.mood, trigger);
  if (!text) return;
  captionState.trigger = trigger;
  captionState.text = text;
  captionState.phase = 'in';
  captionState.phaseStart = performance.now();
  captionLive.textContent = text;
}

/** 自動検出からの発火。連発防止のクールダウン・表示中ガードを適用する。 */
function attemptAutoTrigger(trigger, now) {
  if (captionState.phase !== 'idle') return;
  if (now - lastCaptionHiddenAt < GLOBAL_GAP_MS) return;
  if (trigger === 'sound' && now < soundCooldownUntil) return;
  if (trigger === 'motion' && now < motionCooldownUntil) return;
  if (trigger === 'silence' && now < silenceCooldownUntil) return;

  showCaption(trigger);
  if (trigger === 'sound') soundCooldownUntil = now + SOUND_COOLDOWN_MS;
  if (trigger === 'motion') motionCooldownUntil = now + MOTION_COOLDOWN_MS;
  if (trigger === 'silence') silenceCooldownUntil = now + SILENCE_COOLDOWN_MS;
}

/** 手動キュー。ユーザーの明示操作なので表示中でも即座に差し替える。 */
function manualTrigger(trigger) {
  const now = performance.now();
  showCaption(trigger);
  if (trigger === 'sound') soundCooldownUntil = now + SOUND_COOLDOWN_MS;
  if (trigger === 'motion') motionCooldownUntil = now + MOTION_COOLDOWN_MS;
  if (trigger === 'silence') silenceCooldownUntil = now + SILENCE_COOLDOWN_MS;
}

/** 現在のフェードフェーズを進め、描画に使うアルファ値を返す。 */
function advanceCaptionPhase(now) {
  if (captionState.phase === 'idle') return 0;
  const elapsed = now - captionState.phaseStart;

  if (captionState.phase === 'in') {
    if (elapsed >= FADE_IN_MS) {
      captionState.phase = 'hold';
      captionState.phaseStart = now;
      return 1;
    }
    return clamp01(elapsed / FADE_IN_MS);
  }

  if (captionState.phase === 'hold') {
    if (elapsed >= HOLD_MS) {
      captionState.phase = 'out';
      captionState.phaseStart = now;
    }
    return 1;
  }

  // phase === 'out'
  if (elapsed >= FADE_OUT_MS) {
    captionState.phase = 'idle';
    captionState.text = '';
    lastCaptionHiddenAt = now;
    captionLive.textContent = '';
    return 0;
  }
  return clamp01(1 - elapsed / FADE_OUT_MS);
}

/* =============================================================================
   音量スパイク検出（Web Audio API）
   ============================================================================= */

let analyser = null;
let audioDataArray = null;

function setupAudioAnalysis(stream) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const source = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  // destinationへは接続しない = マイク音をスピーカーへ流さない（ハウリング防止）。解析専用。
  source.connect(analyser);
  audioDataArray = new Float32Array(analyser.fftSize);
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function measureSoundRms() {
  if (!analyser) return 0;
  analyser.getFloatTimeDomainData(audioDataArray);
  let sumSquares = 0;
  for (let i = 0; i < audioDataArray.length; i += 1) {
    sumSquares += audioDataArray[i] * audioDataArray[i];
  }
  return Math.sqrt(sumSquares / audioDataArray.length);
}

/* =============================================================================
   動き検出（Canvasダウンサンプリング + 画素差分）
   ============================================================================= */

function measureMotion() {
  motionCtx.drawImage(video, 0, 0, MOTION_SAMPLE_W, MOTION_SAMPLE_H);
  const frame = motionCtx.getImageData(0, 0, MOTION_SAMPLE_W, MOTION_SAMPLE_H).data;
  const pixelCount = MOTION_SAMPLE_W * MOTION_SAMPLE_H;
  const gray = new Uint8ClampedArray(pixelCount);
  for (let i = 0, p = 0; i < frame.length; i += 4, p += 1) {
    gray[p] = (frame[i] + frame[i + 1] + frame[i + 2]) / 3;
  }

  let avgDiff = 0;
  if (previousGray) {
    let sum = 0;
    for (let p = 0; p < pixelCount; p += 1) {
      sum += Math.abs(gray[p] - previousGray[p]);
    }
    avgDiff = sum / pixelCount;
  }
  previousGray = gray;
  return avgDiff;
}

/* =============================================================================
   描画
   ============================================================================= */

function drawVideoMirroredCover() {
  const srcW = video.videoWidth || CANVAS_W;
  const srcH = video.videoHeight || CANVAS_H;
  const { sx, sy, sw, sh } = computeCoverRect(srcW, srcH, CANVAS_W, CANVAS_H);
  ctx.save();
  ctx.translate(CANVAS_W, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();
}

function drawIdleScreen() {
  ctx.fillStyle = '#050405';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawVignette() {
  ctx.drawImage(vignetteCanvas, 0, 0);
}

function drawLetterboxBars() {
  const barHeight = CANVAS_H * LETTERBOX_RATIO;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_W, barHeight);
  ctx.fillRect(0, CANVAS_H - barHeight, CANVAS_W, barHeight);
  return barHeight;
}

function drawGrain() {
  const pattern = noisePatterns[Math.floor(frameCount / 2) % noisePatterns.length];
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();
}

function drawTimecode(elapsedMs, barHeight) {
  const totalFrames = Math.floor((elapsedMs / 1000) * TIMECODE_FPS);
  const hh = Math.floor(totalFrames / (TIMECODE_FPS * 3600));
  const mm = Math.floor((totalFrames / (TIMECODE_FPS * 60)) % 60);
  const ss = Math.floor((totalFrames / TIMECODE_FPS) % 60);
  const ff = totalFrames % TIMECODE_FPS;
  const label = `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}:${pad2(ff)}`;

  ctx.save();
  ctx.font = '600 20px "IBM Plex Mono", monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(240, 220, 174, 0.88)';
  ctx.fillText(label, 20, CANVAS_H - barHeight / 2);
  ctx.restore();
}

function drawRecIndicator(elapsedMs, barHeight) {
  const blinkOn = Math.floor(elapsedMs / 500) % 2 === 0;
  if (!blinkOn) return;
  const cy = barHeight / 2;
  const dotX = CANVAS_W - 90;

  ctx.save();
  ctx.fillStyle = '#e2453c';
  ctx.beginPath();
  ctx.arc(dotX, cy, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '700 18px "IBM Plex Mono", monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.letterSpacing = '2px';
  ctx.fillText('REC', dotX + 14, cy + 1);
  ctx.restore();
}

function drawSubtitle(alpha, text, barHeight) {
  if (alpha <= 0 || !text) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '700 34px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const x = CANVAS_W / 2;
  const y = CANVAS_H - barHeight - 26;
  ctx.lineWidth = 9;
  ctx.strokeStyle = 'rgba(0,0,0,0.92)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/* =============================================================================
   メインループ
   ============================================================================= */

function tick(now) {
  frameCount += 1;

  if (hasStream) {
    drawVideoMirroredCover();
  } else {
    drawIdleScreen();
  }

  drawVignette();
  const barHeight = drawLetterboxBars();
  drawGrain();

  const elapsedMs = hasStream ? now - sessionStartTime : 0;
  drawTimecode(elapsedMs, barHeight);
  if (hasStream) drawRecIndicator(elapsedMs, barHeight);

  const alpha = advanceCaptionPhase(now);
  drawSubtitle(alpha, captionState.text, barHeight);

  if (hasStream) {
    const rms = measureSoundRms();
    const soundThreshold = lerp(0.32, 0.02, state.soundSensitivity / 100);
    soundMeter.style.width = `${clamp01(rms / 0.5) * 100}%`;
    if (rms >= soundThreshold) attemptAutoTrigger('sound', now);

    const motionDiff = measureMotion();
    const motionThreshold = lerp(28, 2, state.motionSensitivity / 100);
    motionMeter.style.width = `${clamp01(motionDiff / 60) * 100}%`;

    if (motionDiff >= motionThreshold) {
      attemptAutoTrigger('motion', now);
      silenceTimerStart = null;
    } else if (motionDiff < SILENCE_FLOOR) {
      if (silenceTimerStart === null) silenceTimerStart = now;
      if (now - silenceTimerStart >= SILENCE_REQUIRED_QUIET_MS) {
        attemptAutoTrigger('silence', now);
      }
    } else {
      silenceTimerStart = null;
    }
  }

  requestAnimationFrame(tick);
}

/* =============================================================================
   カメラ・マイクの起動
   ============================================================================= */

async function initCamera() {
  startButton.disabled = true;
  startError.hidden = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: CANVAS_W }, height: { ideal: CANVAS_H }, facingMode: 'user' },
      audio: true,
    });

    micStream = stream;
    video.srcObject = stream;
    await video.play();

    setupAudioAnalysis(stream);

    hasStream = true;
    sessionStartTime = performance.now();
    standby.hidden = true;
    snapshotButton.disabled = false;
    clipButton.disabled = false;
    showStatus('準備完了。字幕は自動検出、または手動キューで表示されます。');
  } catch (err) {
    let message = '起動に失敗しました。もう一度お試しください。';
    if (err && err.name === 'NotAllowedError') {
      message = 'カメラ・マイクへのアクセスが許可されませんでした。ブラウザのアドレスバー付近の権限設定を確認し、許可してから再度お試しください。';
    } else if (err && err.name === 'NotFoundError') {
      message = 'カメラまたはマイクが見つかりませんでした。デバイスが接続されているか確認してください。';
    } else if (err && err.name === 'NotReadableError') {
      message = '他のアプリがカメラ/マイクを使用中の可能性があります。他のアプリを閉じて再度お試しください。';
    }
    startError.textContent = message;
    startError.hidden = false;
    startButton.disabled = false;
  }
}

/* =============================================================================
   スナップショット / クリップ保存
   ============================================================================= */

function takeSnapshot() {
  stageCanvas.toBlob((blob) => {
    if (!blob) {
      showStatus('スナップショットの生成に失敗しました。');
      return;
    }
    downloadBlob(blob, `ambient-subtitle-cam-${timestampForFilename()}.png`);
    showStatus('スナップショットを保存しました。');
  }, 'image/png');
}

function pickSupportedMimeType() {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return candidates.find((c) => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c));
}

function recordClip() {
  if (!hasStream || isRecordingClip) return;
  if (!window.MediaRecorder) {
    showStatus('このブラウザはクリップ録画（MediaRecorder）に対応していません。');
    return;
  }

  isRecordingClip = true;
  clipButton.disabled = true;
  clipButton.classList.add('is-recording');
  clipButton.textContent = '録画中… (3秒)';
  snapshotButton.disabled = true;
  showStatus('3秒間のクリップを録画しています…');

  const canvasStream = stageCanvas.captureStream(30);
  const audioTrack = micStream ? micStream.getAudioTracks()[0] : null;
  if (audioTrack) canvasStream.addTrack(audioTrack);

  const mimeType = pickSupportedMimeType();
  const recorder = new MediaRecorder(canvasStream, mimeType ? { mimeType } : undefined);
  const chunks = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
    downloadBlob(blob, `ambient-subtitle-cam-clip-${timestampForFilename()}.webm`);
    showStatus('クリップを保存しました。');
    isRecordingClip = false;
    clipButton.disabled = false;
    clipButton.classList.remove('is-recording');
    clipButton.textContent = '3秒クリップを録画 (WebM)';
    snapshotButton.disabled = false;
  };

  recorder.start();
  setTimeout(() => {
    if (recorder.state !== 'inactive') recorder.stop();
  }, 3000);
}

/* =============================================================================
   イベント配線
   ============================================================================= */

startButton.addEventListener('click', initCamera);
snapshotButton.addEventListener('click', takeSnapshot);
clipButton.addEventListener('click', recordClip);

moodButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    state.mood = btn.dataset.mood;
    moodButtons.forEach((b) => {
      const active = b === btn;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-checked', String(active));
    });
  });
});

cueButtons.forEach((btn) => {
  btn.addEventListener('click', () => manualTrigger(btn.dataset.trigger));
});

soundSlider.addEventListener('input', (e) => {
  state.soundSensitivity = Number(e.target.value);
  soundValueEl.textContent = e.target.value;
});

motionSlider.addEventListener('input', (e) => {
  state.motionSensitivity = Number(e.target.value);
  motionValueEl.textContent = e.target.value;
});

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.key === '1') manualTrigger('sound');
  else if (e.key === '2') manualTrigger('motion');
  else if (e.key === '3') manualTrigger('silence');
});

/* =============================================================================
   起動
   ============================================================================= */

requestAnimationFrame(tick);
