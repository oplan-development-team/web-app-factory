// カーソル相撲 ゲーム本体。ステートマシン（TITLE/COUNTDOWN/PLAYING/ROUND_END/MATCH_END）と
// 物理更新・描画・入力・演出・音声トリガーをまとめる。

import { Rikishi, applyMovement, tryDash, resolveCollision, vecLen, normalize } from "./physics.js";
import { SumoAudio } from "./audio.js";
import { decideCategory, generateRoundComment, generateFinalComment } from "./comments.js";

const COLORS = {
  washi: "#f5f0e6",
  washiDeep: "#ece3d1",
  ink: "#111111",
  shu: "#e63838",
  shuDeep: "#a82323",
  ai: "#1f3a5f",
  aiDeep: "#14283f",
  gold: "#f2b705",
};

const STATE = {
  TITLE: "TITLE",
  COUNTDOWN: "COUNTDOWN",
  PLAYING: "PLAYING",
  ROUND_END: "ROUND_END",
  MATCH_END: "MATCH_END",
};

const SHAKE_DURATION = 320; // ms
const HITSTOP_DURATION = 150; // ms
const ROUND_END_DURATION = 1900; // ms（行司スタンプの表示時間）

export class Game {
  constructor(canvas, dom) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dom = dom;
    this.audio = new SumoAudio();

    this.width = canvas.width;
    this.height = canvas.height;
    this.ringCenter = { x: this.width / 2, y: this.height / 2 + 10 };
    this.ringRadius = 210;
    this.playerRadius = 40;

    this.state = STATE.TITLE;
    this.keys = new Set();

    this.score = [0, 0];
    this.maxWins = 3;
    this.roundNumber = 1;

    this.countdownPhase = 0;
    this.countdownTimer = 0;

    this.hitStopTimer = 0;
    this.shakeTimer = 0;
    this.shakeMagnitude = 0;
    this.roundEndTimer = 0;

    this.pendingResult = null;
    this.matchDecided = false;
    this.roundWinnerIdx = 0;

    this.lastTime = 0;

    this._initPlayers();
    this._bindInput();
    this.loop = this.loop.bind(this);
  }

  _initPlayers() {
    const { x: cx, y: cy } = this.ringCenter;
    this.p1 = new Rikishi({
      id: "p1",
      label: "東",
      side: "shu",
      color: "shu",
      x: cx - 150,
      y: cy,
      radius: this.playerRadius,
    });
    this.p2 = new Rikishi({
      id: "p2",
      label: "西",
      side: "ai",
      color: "ai",
      x: cx + 150,
      y: cy,
      radius: this.playerRadius,
    });
    this.players = [this.p1, this.p2];
  }

  _resetPositions() {
    const { x: cx, y: cy } = this.ringCenter;
    this.p1.reset(cx - 150, cy);
    this.p2.reset(cx + 150, cy);
  }

  _bindInput() {
    window.addEventListener("keydown", (e) => this._onKeyDown(e));
    window.addEventListener("keyup", (e) => this._onKeyUp(e));
  }

  _onKeyDown(e) {
    const code = e.code;
    const gameKeys = new Set([
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "Space",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Enter",
      "ShiftRight",
      "Escape",
    ]);
    if (gameKeys.has(code)) e.preventDefault();

    if (code === "Escape") {
      if (
        this.state === STATE.COUNTDOWN ||
        this.state === STATE.PLAYING ||
        this.state === STATE.ROUND_END ||
        this.state === STATE.MATCH_END
      ) {
        this.abortToTitle();
      }
      return;
    }

    if (this.state === STATE.TITLE) {
      if (code === "Space" || code === "Enter") {
        this.startMatch();
      }
      return;
    }

    if (this.state === STATE.MATCH_END) {
      if (code === "Space" || code === "Enter" || code === "ShiftRight") {
        this.rematch();
      }
      return;
    }

    this.keys.add(code);

    if (this.state === STATE.PLAYING && this.hitStopTimer <= 0 && !e.repeat) {
      if (code === "Space") {
        this._attemptDash(this.p1);
      } else if (code === "Enter" || code === "ShiftRight") {
        this._attemptDash(this.p2);
      }
    }
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
  }

  _attemptDash(player) {
    const dir = this._currentInputDir(player);
    const ok = tryDash(player, dir.x, dir.y);
    if (ok) this.audio.playDash();
  }

  _currentInputDir(player) {
    let x = 0;
    let y = 0;
    if (player === this.p1) {
      if (this.keys.has("KeyA")) x -= 1;
      if (this.keys.has("KeyD")) x += 1;
      if (this.keys.has("KeyW")) y -= 1;
      if (this.keys.has("KeyS")) y += 1;
    } else {
      if (this.keys.has("ArrowLeft")) x -= 1;
      if (this.keys.has("ArrowRight")) x += 1;
      if (this.keys.has("ArrowUp")) y -= 1;
      if (this.keys.has("ArrowDown")) y += 1;
    }
    return { x, y };
  }

  // ---------- 画面遷移 ----------

  startMatch() {
    this.audio.ensureContext();
    this.score = [0, 0];
    this.roundNumber = 1;
    this._showScreen("game");
    this._updateScoreUI();
    this._beginCountdown();
  }

  rematch() {
    this.audio.ensureContext();
    this.score = [0, 0];
    this.roundNumber = 1;
    this._showScreen("game");
    this._updateScoreUI();
    this._beginCountdown();
  }

  abortToTitle() {
    this.state = STATE.TITLE;
    this.keys.clear();
    this.dom.stampOverlay.classList.add("hidden");
    this.dom.countdownOverlay.classList.add("hidden");
    this._showScreen("title");
  }

  _showScreen(name) {
    this.dom.screens.title.classList.toggle("hidden", name !== "title");
    this.dom.screens.game.classList.toggle("hidden", name !== "game");
    this.dom.screens.matchend.classList.toggle("hidden", name !== "matchend");
  }

  _beginCountdown() {
    this._resetPositions();
    // 注意: ここで this.keys をクリアしない。物理キーボードでは、次の本の
    // カウントダウンが始まる瞬間も移動キーを押しっぱなしにしている場合があり、
    // Setをクリアすると「離して押し直す」までその方向の移動が反応しなくなる
    // （keydownイベントは押しっぱなし中は再発火しないため）。
    this.state = STATE.COUNTDOWN;
    this.countdownPhase = 0;
    this.countdownTimer = 0;
    this._updateRoundLabel();
    this.dom.countdownOverlay.classList.remove("hidden");
    this._setCountdownText("はっけよい");
    this.audio.playTick();
  }

  _setCountdownText(text) {
    const el = this.dom.countdownText;
    el.textContent = text;
    el.style.animation = "none";
    // reflow を強制して再生できるようにする
    void el.offsetWidth;
    el.style.animation = "";
  }

  _updateRoundLabel() {
    this.dom.roundLabel.textContent = `第${this.roundNumber}本`;
  }

  // ---------- メインループ ----------

  start() {
    requestAnimationFrame(this.loop);
  }

  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    dt = Math.min(dt, 1 / 30);

    this.update(dt);
    this.render();

    requestAnimationFrame(this.loop);
  }

  update(dt) {
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt * 1000);
    }

    switch (this.state) {
      case STATE.COUNTDOWN:
        this._updateCountdown(dt);
        break;
      case STATE.PLAYING:
        this._updatePlaying(dt);
        break;
      case STATE.ROUND_END:
        this._updateRoundEnd(dt);
        break;
      default:
        break;
    }

    this._updateGaugeUI();
  }

  _updateCountdown(dt) {
    this.countdownTimer += dt * 1000;
    if (this.countdownPhase === 0 && this.countdownTimer > 900) {
      this.countdownPhase = 1;
      this.countdownTimer = 0;
      this._setCountdownText("のこった!");
      this.audio.playTick();
    } else if (this.countdownPhase === 1 && this.countdownTimer > 650) {
      this.dom.countdownOverlay.classList.add("hidden");
      this.state = STATE.PLAYING;
      this.hitStopTimer = 0;
    }
  }

  _updatePlaying(dt) {
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt * 1000);
      if (this.hitStopTimer <= 0) {
        this._finalizeElimination();
      }
      return;
    }

    const dir1 = this._currentInputDir(this.p1);
    const dir2 = this._currentInputDir(this.p2);
    applyMovement(this.p1, dir1.x, dir1.y, dt);
    applyMovement(this.p2, dir2.x, dir2.y, dt);

    const impact = resolveCollision(this.p1, this.p2);
    if (impact > 0) {
      this.audio.playHit(Math.min(1, impact / 600));
    }

    const { x: cx, y: cy } = this.ringCenter;
    const d1 = vecLen(this.p1.x - cx, this.p1.y - cy);
    const d2 = vecLen(this.p2.x - cx, this.p2.y - cy);

    if (d1 > this.ringRadius) {
      this._triggerElimination(this.p1, this.p2, d1 - this.ringRadius);
    } else if (d2 > this.ringRadius) {
      this._triggerElimination(this.p2, this.p1, d2 - this.ringRadius);
    }
  }

  _triggerElimination(loser, winner, overshoot) {
    const loserSpeed = vecLen(loser.vx, loser.vy);
    const toOpponent = normalize(winner.x - loser.x, winner.y - loser.y);
    const velDir = normalize(loser.vx, loser.vy);
    const advancingDot = velDir.x * toOpponent.x + velDir.y * toOpponent.y;
    const loserWasAdvancing = advancingDot > 0.3 && loserSpeed > 50;

    const category = decideCategory({ overshoot, loserSpeed, loserWasAdvancing });
    const comment = generateRoundComment(category, winner.label, loser.label);

    this.pendingResult = { winner, loser, comment };
    this.hitStopTimer = HITSTOP_DURATION;
    this.shakeTimer = SHAKE_DURATION;
    this.shakeMagnitude = 14;
    this.audio.playOut();
  }

  _finalizeElimination() {
    const { winner, comment } = this.pendingResult;
    const winnerIdx = winner === this.p1 ? 0 : 1;
    this.score[winnerIdx] += 1;
    this._updateScoreUI();
    this._showStamp(comment.main, comment.sub);

    this.state = STATE.ROUND_END;
    this.roundEndTimer = ROUND_END_DURATION;
    this.matchDecided = this.score[winnerIdx] >= this.maxWins;
    this.roundWinnerIdx = winnerIdx;
  }

  _updateRoundEnd(dt) {
    this.roundEndTimer -= dt * 1000;
    if (this.roundEndTimer <= 0) {
      this._hideStamp();
      if (this.matchDecided) {
        this._showMatchEnd();
      } else {
        this.roundNumber += 1;
        this._beginCountdown();
      }
    }
  }

  _showStamp(main, sub) {
    const rot = (Math.random() * 10 - 5).toFixed(1);
    this.dom.hanko.style.setProperty("--hanko-rot", `${rot}deg`);
    this.dom.hankoMain.textContent = main;
    this.dom.hankoSub.textContent = sub;
    this.dom.stampOverlay.classList.remove("hidden");
  }

  _hideStamp() {
    this.dom.stampOverlay.classList.add("hidden");
  }

  _showMatchEnd() {
    const winner = this.players[this.roundWinnerIdx];
    const loser = this.players[this.roundWinnerIdx === 0 ? 1 : 0];
    this.state = STATE.MATCH_END;
    this._showScreen("matchend");

    this.dom.resultWinner.textContent = `${winner.label}の勝ち`;
    this.dom.resultWinner.className = "result-winner " + (winner.side === "shu" ? "is-shu" : "is-ai");
    this.dom.resultScore.textContent = `${this.score[0]} - ${this.score[1]}（東 - 西）`;

    const finalComment = generateFinalComment(winner.label, loser.label);
    const rot = (Math.random() * 8 - 4).toFixed(1);
    this.dom.hankoFinal.style.setProperty("--hanko-rot", `${rot}deg`);
    this.dom.hankoFinalMain.textContent = finalComment.main;
    this.dom.hankoFinalSub.textContent = finalComment.sub;
  }

  _updateScoreUI() {
    this._renderMarks(this.dom.scoreP1, this.score[0]);
    this._renderMarks(this.dom.scoreP2, this.score[1]);
  }

  _renderMarks(container, wins) {
    container.innerHTML = "";
    for (let i = 0; i < this.maxWins; i += 1) {
      const el = document.createElement("span");
      el.className = "score-mark" + (i < wins ? " is-won" : "");
      container.appendChild(el);
    }
  }

  _updateGaugeUI() {
    const g1 = this.p1.dashCooldown <= 0 ? 100 : 100 * (1 - this.p1.dashCooldown / this.p1.dashCooldownMax);
    const g2 = this.p2.dashCooldown <= 0 ? 100 : 100 * (1 - this.p2.dashCooldown / this.p2.dashCooldownMax);
    this.dom.gaugeP1.style.width = `${g1}%`;
    this.dom.gaugeP2.style.width = `${g2}%`;
    this.dom.gaugeP1.classList.toggle("is-ready", this.p1.dashCooldown <= 0);
    this.dom.gaugeP2.classList.toggle("is-ready", this.p2.dashCooldown <= 0);
  }

  // ---------- 描画 ----------

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);

    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeTimer > 0) {
      const ratio = this.shakeTimer / SHAKE_DURATION;
      shakeX = (Math.random() * 2 - 1) * this.shakeMagnitude * ratio;
      shakeY = (Math.random() * 2 - 1) * this.shakeMagnitude * ratio;
    }
    ctx.translate(shakeX, shakeY);

    ctx.fillStyle = COLORS.washi;
    ctx.fillRect(-20, -20, this.width + 40, this.height + 40);

    this._drawDohyo(ctx);
    this._drawRikishi(ctx, this.p1);
    this._drawRikishi(ctx, this.p2);

    ctx.restore();
  }

  _drawDohyo(ctx) {
    const { x: cx, y: cy } = this.ringCenter;
    const r = this.ringRadius;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.washiDeep;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();

    const tawaraR = r + 18;

    ctx.save();
    ctx.lineWidth = 24;
    ctx.setLineDash([26, 12]);
    ctx.lineDashOffset = 0;
    ctx.strokeStyle = COLORS.gold;
    ctx.beginPath();
    ctx.arc(cx, cy, tawaraR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineDashOffset = 26;
    ctx.strokeStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(cx, cy, tawaraR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    const tickCount = 24;
    for (let i = 0; i < tickCount; i += 1) {
      const angle = (i / tickCount) * Math.PI * 2;
      const innerX = cx + Math.cos(angle) * (tawaraR - 13);
      const innerY = cy + Math.sin(angle) * (tawaraR - 13);
      const outerX = cx + Math.cos(angle) * (tawaraR + 13);
      const outerY = cy + Math.sin(angle) * (tawaraR + 13);
      ctx.beginPath();
      ctx.moveTo(innerX, innerY);
      ctx.lineTo(outerX, outerY);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(17,17,17,0.25)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 50, cy);
    ctx.lineTo(cx - 14, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 14, cy);
    ctx.lineTo(cx + 50, cy);
    ctx.stroke();
    ctx.restore();
  }

  _drawRikishi(ctx, player) {
    const isShu = player.side === "shu";
    const mainColor = isShu ? COLORS.shu : COLORS.ai;
    const deepColor = isShu ? COLORS.shuDeep : COLORS.aiDeep;

    ctx.save();
    ctx.translate(player.x, player.y);

    // 突っ張りゲージのリング
    ctx.save();
    if (player.dashCooldown <= 0) {
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = "rgba(17,17,17,0.35)";
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
    }
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // ダッシュ発動の残光
    if (player.dashFlashTimer > 0) {
      const t = player.dashFlashTimer / 180;
      ctx.save();
      ctx.globalAlpha = t * 0.7;
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius + (1 - t) * 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 胴体
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = mainColor;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(0, -player.radius * 0.15, player.radius * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = deepColor;
    ctx.fill();
    ctx.restore();

    // まわし（帯）
    const beltTop = -player.radius * 0.18;
    const beltBottom = player.radius * 0.28;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-player.radius, beltTop, player.radius * 2, beltBottom - beltTop);
    ctx.clip();
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.gold;
    ctx.fill();
    ctx.restore();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLORS.ink;
    ctx.beginPath();
    ctx.moveTo(-player.radius, beltTop);
    ctx.lineTo(player.radius, beltTop);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-player.radius, beltBottom);
    ctx.lineTo(player.radius, beltBottom);
    ctx.stroke();

    // ラベル
    ctx.fillStyle = "#ffffff";
    ctx.font = '900 17px "Zen Kaku Gothic New", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(player.label, 0, -player.radius * 0.5);

    // 向き（直近の入力/ダッシュ方向）インジケータ: 縁に添う小さな矢じり
    const angle = Math.atan2(player.facing.y, player.facing.x);
    const tipX = Math.cos(angle) * (player.radius + 12);
    const tipY = Math.sin(angle) * (player.radius + 12);
    const b1 = angle + Math.PI * 0.14;
    const b2 = angle - Math.PI * 0.14;
    const b1x = Math.cos(b1) * (player.radius - 6);
    const b1y = Math.sin(b1) * (player.radius - 6);
    const b2x = Math.cos(b2) * (player.radius - 6);
    const b2y = Math.sin(b2) * (player.radius - 6);
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(b1x, b1y);
    ctx.lineTo(b2x, b2y);
    ctx.closePath();
    ctx.fillStyle = COLORS.gold;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}

export { STATE };
