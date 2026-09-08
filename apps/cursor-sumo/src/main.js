import { Game } from "./game.js";

function collectDom() {
  return {
    screens: {
      title: document.getElementById("screen-title"),
      game: document.getElementById("screen-game"),
      matchend: document.getElementById("screen-matchend"),
    },
    scoreP1: document.getElementById("score-p1"),
    scoreP2: document.getElementById("score-p2"),
    gaugeP1: document.getElementById("gauge-p1"),
    gaugeP2: document.getElementById("gauge-p2"),
    roundLabel: document.getElementById("round-label"),
    countdownOverlay: document.getElementById("countdown-overlay"),
    countdownText: document.getElementById("countdown-text"),
    stampOverlay: document.getElementById("stamp-overlay"),
    hanko: document.getElementById("hanko"),
    hankoMain: document.getElementById("hanko-main"),
    hankoSub: document.getElementById("hanko-sub"),
    resultWinner: document.getElementById("result-winner"),
    resultScore: document.getElementById("result-score"),
    hankoFinal: document.getElementById("hanko-final"),
    hankoFinalMain: document.getElementById("hanko-final-main"),
    hankoFinalSub: document.getElementById("hanko-final-sub"),
  };
}

function init() {
  const canvas = document.getElementById("ring-canvas");
  const dom = collectDom();
  const game = new Game(canvas, dom);
  game.start();

  document.getElementById("start-btn").addEventListener("click", () => game.startMatch());
  document.getElementById("rematch-btn").addEventListener("click", () => game.rematch());
  document.getElementById("title-btn").addEventListener("click", () => game.abortToTitle());

  const muteBtn = document.getElementById("mute-btn");
  const muteLabel = muteBtn.querySelector(".mute-label");
  const muteIcon = muteBtn.querySelector(".mute-icon");
  muteBtn.addEventListener("click", () => {
    game.audio.ensureContext();
    const nextMuted = !game.audio.muted;
    game.audio.setMuted(nextMuted);
    muteBtn.setAttribute("aria-pressed", String(nextMuted));
    muteLabel.textContent = nextMuted ? "ミュート中" : "音あり";
    muteIcon.textContent = nextMuted ? "✕" : "♪";
  });

  // 物理キーボードを前提としない環境（スマートフォン等）への警告表示。
  // pointer:coarse かつ pointer:fine が存在しない環境を「物理キーボード非対応の可能性が高い」とみなす。
  const coarseOnly =
    window.matchMedia("(pointer: coarse)").matches &&
    !window.matchMedia("(any-pointer: fine)").matches;
  if (coarseOnly) {
    const warning = document.getElementById("mobile-warning");
    warning.classList.remove("hidden");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
