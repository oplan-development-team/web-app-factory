// app.js — orchestrates DOM, keydown timing capture, and rendering.
// Only numeric keydown-to-keydown intervals are used; typed characters are
// never read, stored, or transmitted anywhere.

import { EcgTrace } from "./ecg-canvas.js";
import { diagnose, computeStats, MIN_KEYSTROKES_FOR_DIAGNOSIS, AUTO_DIAGNOSE_IDLE_MS } from "./diagnosis.js";

const $ = (id) => document.getElementById(id);

const els = {
  canvas: $("ecgCanvas"),
  textarea: $("typingInput"),
  bpm: $("bpmValue"),
  keyCount: $("keyCount"),
  elapsed: $("elapsedTime"),
  status: $("statusMessage"),
  diagnoseBtn: $("diagnoseBtn"),
  saveBtn: $("saveBtn"),
  resetBtn: $("resetBtn"),
  reportPanel: $("reportPanel"),
  reportTime: $("reportTime"),
  reportName: $("reportName"),
  reportComment: $("reportComment"),
  statMeanInterval: $("statMeanInterval"),
  statCv: $("statCv"),
  statAvgBpm: $("statAvgBpm"),
  statTotalKeys: $("statTotalKeys"),
  lampSignal: $("lampSignal"),
  lampAlarm: $("lampAlarm"),
};

const IGNORED_KEYS = new Set([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "CapsLock",
  "Tab",
  "Escape",
  "ContextMenu",
  "OS",
]);

const trace = new EcgTrace(els.canvas);
trace.start();

/** @type {number[]} */
let intervals = [];
let recentIntervals = [];
let keyCount = 0;
let lastKeydownTime = null;
let startTime = null;
let idleTimer = null;
let signalActiveTimer = null;
let lastDiagnosis = null;
let elapsedTimerId = null;

function intervalToIntensity(intervalMs) {
  const FAST = 70; // ms -> intensity 1 (sharp, tall spike)
  const SLOW = 600; // ms -> intensity ~0 (flat, near baseline)
  const clamped = Math.max(FAST, Math.min(SLOW, intervalMs));
  return 1 - (clamped - FAST) / (SLOW - FAST);
}

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function pulseSignalLamp() {
  els.lampSignal.classList.add("is-on");
  clearTimeout(signalActiveTimer);
  signalActiveTimer = setTimeout(() => {
    els.lampSignal.classList.remove("is-on");
  }, 900);
}

function updateVitals() {
  els.keyCount.textContent = String(keyCount);

  if (recentIntervals.length > 0) {
    const meanRecent = recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length;
    const bpm = Math.round(Math.max(30, Math.min(240, 60000 / meanRecent)));
    els.bpm.textContent = String(bpm);
  } else {
    els.bpm.textContent = "--";
  }
}

function updateElapsed() {
  if (startTime === null) {
    els.elapsed.textContent = "00:00";
    return;
  }
  els.elapsed.textContent = formatElapsed(performance.now() - startTime);
}

function updateStatus() {
  if (lastDiagnosis) {
    els.status.classList.add("is-hidden");
    return;
  }
  els.status.classList.remove("is-hidden");
  if (keyCount === 0) {
    els.status.textContent = "SIGNAL WAITING — 入力を開始してください（診断には20打鍵以上必要）";
  } else if (keyCount < MIN_KEYSTROKES_FOR_DIAGNOSIS) {
    const remain = MIN_KEYSTROKES_FOR_DIAGNOSIS - keyCount;
    els.status.textContent = `計測中... 診断まであと ${remain} 打鍵`;
  } else {
    els.status.textContent =
      "診断可能です。「診断する」を押すか、入力を1.5秒止めると自動的に診断します。";
  }
}

function updateButtons() {
  els.diagnoseBtn.disabled = keyCount < MIN_KEYSTROKES_FOR_DIAGNOSIS;
}

function scheduleIdleAutoDiagnose() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (keyCount >= MIN_KEYSTROKES_FOR_DIAGNOSIS) {
      runDiagnosis();
    }
  }, AUTO_DIAGNOSE_IDLE_MS);
}

function runDiagnosis() {
  const result = diagnose(intervals);
  if (!result) return;
  lastDiagnosis = result;

  els.reportPanel.hidden = false;
  els.reportTime.textContent = new Date().toLocaleTimeString("ja-JP", { hour12: false });
  els.reportName.textContent = result.name;
  els.reportComment.textContent = result.comment;
  els.statMeanInterval.textContent = `${result.mean.toFixed(0)} ms`;
  els.statCv.textContent = result.cv.toFixed(2);
  els.statAvgBpm.textContent = `${Math.round(Math.max(30, Math.min(240, 60000 / result.mean)))} bpm`;
  els.statTotalKeys.textContent = String(keyCount);

  els.lampAlarm.classList.toggle("is-on", result.regularity === "unstable");
  els.saveBtn.disabled = false;
  updateStatus();
}

function onKeydown(event) {
  if (event.repeat) return;
  if (IGNORED_KEYS.has(event.key)) return;

  const now = performance.now();
  keyCount += 1;

  if (lastKeydownTime !== null) {
    const interval = now - lastKeydownTime;
    if (interval > 0 && interval < 5000) {
      intervals.push(interval);
      recentIntervals.push(interval);
      if (recentIntervals.length > 8) recentIntervals.shift();
    }
    trace.addSpike(intervalToIntensity(interval));
  } else {
    startTime = now;
    trace.addSpike(0.5);
    if (!elapsedTimerId) {
      elapsedTimerId = setInterval(updateElapsed, 250);
    }
  }
  lastKeydownTime = now;

  pulseSignalLamp();
  updateVitals();
  updateButtons();
  updateStatus();
  scheduleIdleAutoDiagnose();
}

function reset() {
  intervals = [];
  recentIntervals = [];
  keyCount = 0;
  lastKeydownTime = null;
  startTime = null;
  lastDiagnosis = null;
  clearTimeout(idleTimer);
  clearInterval(elapsedTimerId);
  elapsedTimerId = null;

  trace.reset();
  els.textarea.value = "";
  els.reportPanel.hidden = true;
  els.lampAlarm.classList.remove("is-on");
  els.saveBtn.disabled = true;

  updateVitals();
  updateElapsed();
  updateButtons();
  updateStatus();
  els.textarea.focus();
}

/* -------------------------------------------------------------------
   PNG export — composes waveform + report onto an offscreen canvas
   using Canvas 2D API only (no external libraries).
   ------------------------------------------------------------------- */

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const chars = Array.from(text);
  let line = "";
  let cursorY = y;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, cursorY);
      line = ch;
      cursorY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
  return cursorY + lineHeight;
}

async function exportPng() {
  try {
    await document.fonts.ready;
  } catch (_) {
    /* font loading API unavailable — proceed with fallback fonts */
  }

  const W = 1000;
  const H = lastDiagnosis ? 780 : 520;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // chassis background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, "#1f2216");
  bgGrad.addColorStop(1, "#0d0f0a");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#383c28";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  // header
  ctx.fillStyle = "#d9e8dd";
  ctx.font = "700 26px 'Share Tech Mono', monospace";
  ctx.fillText("CARDIO-TYPE 3000 — TYPING ECG", 28, 44);
  ctx.fillStyle = "#6f8f77";
  ctx.font = "13px 'Share Tech Mono', monospace";
  ctx.fillText(new Date().toLocaleString("ja-JP"), 28, 64);

  // screen panel
  const screenX = 24;
  const screenY = 84;
  const screenW = W - 48;
  const screenH = 240;
  const screenGrad = ctx.createLinearGradient(0, screenY, 0, screenY + screenH);
  screenGrad.addColorStop(0, "#04150c");
  screenGrad.addColorStop(1, "#010a06");
  ctx.fillStyle = screenGrad;
  ctx.fillRect(screenX, screenY, screenW, screenH);

  // grid
  ctx.strokeStyle = "rgba(57,255,106,0.08)";
  ctx.lineWidth = 1;
  for (let gx = screenX; gx < screenX + screenW; gx += 25) {
    ctx.beginPath();
    ctx.moveTo(gx, screenY);
    ctx.lineTo(gx, screenY + screenH);
    ctx.stroke();
  }
  for (let gy = screenY; gy < screenY + screenH; gy += 25) {
    ctx.beginPath();
    ctx.moveTo(screenX, gy);
    ctx.lineTo(screenX + screenW, gy);
    ctx.stroke();
  }

  // waveform snapshot (reuses the live trace buffer)
  trace.drawSnapshotTo(ctx, screenX, screenY, screenW, screenH);

  // vitals row
  const bpmText = els.bpm.textContent;
  ctx.fillStyle = "#39ff6a";
  ctx.font = "700 22px 'Share Tech Mono', monospace";
  ctx.shadowColor = "rgba(57,255,106,0.6)";
  ctx.shadowBlur = 8;
  ctx.fillText(`HR ${bpmText} BPM`, screenX + 16, screenY + 34);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#ffb000";
  ctx.font = "14px 'Share Tech Mono', monospace";
  ctx.fillText(`KEYSTROKES ${els.keyCount.textContent}`, screenX + 16, screenY + screenH - 34);
  ctx.fillText(`ELAPSED ${els.elapsed.textContent}`, screenX + 16, screenY + screenH - 14);

  // report
  if (lastDiagnosis) {
    const reportY = screenY + screenH + 28;
    ctx.fillStyle = "#010a06";
    ctx.fillRect(screenX, reportY, screenW, H - reportY - 24);
    ctx.strokeStyle = "rgba(57,255,106,0.18)";
    ctx.strokeRect(screenX, reportY, screenW, H - reportY - 24);

    ctx.fillStyle = "#ffb000";
    ctx.font = "13px 'Share Tech Mono', monospace";
    ctx.fillText("検査結果レポート（ジョーク診断・医学的根拠なし）", screenX + 18, reportY + 26);

    ctx.fillStyle = "#39ff6a";
    ctx.font = "700 26px 'Share Tech Mono', monospace";
    ctx.shadowColor = "rgba(57,255,106,0.6)";
    ctx.shadowBlur = 8;
    ctx.fillText(lastDiagnosis.name, screenX + 18, reportY + 62);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#cfe9d6";
    ctx.font = "15px 'Share Tech Mono', monospace";
    wrapText(ctx, lastDiagnosis.comment, screenX + 18, reportY + 92, screenW - 36, 22);

    ctx.fillStyle = "#ffb000";
    ctx.font = "14px 'Share Tech Mono', monospace";
    const statsY = reportY + 200;
    ctx.fillText(`平均間隔: ${lastDiagnosis.mean.toFixed(0)} ms`, screenX + 18, statsY);
    ctx.fillText(`変動係数(CV): ${lastDiagnosis.cv.toFixed(2)}`, screenX + 18, statsY + 22);
    ctx.fillText(`総打鍵数: ${keyCount}`, screenX + 18, statsY + 44);
  }

  ctx.fillStyle = "#6f8f77";
  ctx.font = "11px 'Share Tech Mono', monospace";
  ctx.fillText("app-factory自律生成プロトタイプ / タイピング心電図 — 実際の医療機器ではありません", screenX, H - 8);

  const dataUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `typing-ecg-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* --------------------------------------------------------------------- */

els.textarea.addEventListener("keydown", onKeydown);
els.diagnoseBtn.addEventListener("click", runDiagnosis);
els.resetBtn.addEventListener("click", reset);
els.saveBtn.addEventListener("click", () => {
  exportPng();
});

updateVitals();
updateElapsed();
updateButtons();
updateStatus();
