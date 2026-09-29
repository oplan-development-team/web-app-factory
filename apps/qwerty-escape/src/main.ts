import './style.css';
import { PUZZLES } from './data/puzzles';
import type { LayoutId, Puzzle } from './types';
import { KeyboardView, type KeyActivateSource } from './keyboardView';
import { PuzzleController } from './puzzleController';
import { LockDial, createBigLock } from './lockDial';
import { SfxEngine } from './audio';
import { confirmModal } from './confirm';

const SKELETON = `
  <div class="app-shell">
    <header class="app-header" id="app-header">
      <div class="brand">
        <span class="brand-mark">QWERTY</span><span class="brand-mark brand-mark-accent">ESCAPE</span>
      </div>
      <div class="lock-dial" id="lock-dial" aria-label="開錠プログレス"></div>
      <div class="header-controls">
        <span class="timer mono" id="timer">00:00</span>
        <button type="button" class="ctrl-btn" id="layout-toggle" aria-label="配列を切り替える">US</button>
        <button type="button" class="ctrl-btn" id="mute-toggle" aria-label="ミュート切り替え" aria-pressed="false">♪ ON</button>
        <button type="button" class="ctrl-btn ctrl-btn-hazard" id="reset-btn">RESET</button>
      </div>
    </header>

    <section id="screen-title" class="screen screen-title">
      <div class="title-inner">
        <p class="title-eyebrow mono">PHYSICAL KEYBOARD ESCAPE ROOM</p>
        <h1 class="title-headline">QWERTY<br />ESCAPE</h1>
        <p class="title-copy">
          物理キーボードの配列そのものが、謎の盤面になる。<br />
          文字の意味ではなく、キーの「空間的な形」を読み解いて、9個の南京錠を開錠せよ。
        </p>
        <div class="title-note mono">
          <p>▸ 物理キーボードでのプレイを推奨します</p>
          <p>▸ 物理キーボードが無い場合は、画面上のキーボードをタップして操作できます</p>
        </div>
        <div class="touch-banner" id="touch-banner" hidden>
          タッチのみのデバイスを検出しました。画面上のキーボードをタップして遊べます（物理キーボードがあれば推奨します）。
        </div>
        <button type="button" class="btn btn-amber btn-lg" id="start-btn">解錠を始める</button>
      </div>
    </section>

    <section id="screen-game" class="screen screen-game" hidden>
      <div class="game-grid">
        <div class="puzzle-card" id="puzzle-card">
          <span class="puzzle-card-bolt bolt-tl"></span>
          <span class="puzzle-card-bolt bolt-br"></span>
          <p class="puzzle-eyebrow mono" id="puzzle-eyebrow">PROBLEM 01 / 09</p>
          <h2 class="puzzle-title" id="puzzle-title"></h2>
          <p class="puzzle-mode mono" id="puzzle-mode"></p>
          <p class="puzzle-flavor" id="puzzle-flavor"></p>
          <div class="puzzle-solved-badge" id="solved-badge" hidden>
            <div class="big-lock-slot" id="big-lock-slot"></div>
            <p class="solved-shape mono" id="solved-shape"></p>
          </div>
          <p class="puzzle-status mono" id="puzzle-status" aria-live="polite"></p>
          <div class="puzzle-actions">
            <button type="button" class="btn btn-ghost" id="hint-btn">ヒント</button>
            <button type="button" class="btn btn-amber" id="next-btn" hidden>次へ</button>
          </div>
        </div>
        <div class="keyboard-tray-wrap">
          <p class="tray-scroll-hint mono">← 盤面が画面より広い場合は横にスクロールできます →</p>
          <div class="keyboard-tray">
            <div class="keyboard-grid" id="keyboard-grid"></div>
          </div>
        </div>
      </div>
    </section>
  </div>

  <div class="vault-overlay" id="vault-overlay" hidden>
    <div class="vault-door door-left"><span class="vault-rivet r1"></span><span class="vault-rivet r2"></span><span class="vault-rivet r3"></span></div>
    <div class="vault-door door-right"><span class="vault-rivet r1"></span><span class="vault-rivet r2"></span><span class="vault-rivet r3"></span></div>
    <div class="vault-light"></div>
    <div class="vault-content">
      <p class="vault-eyebrow mono">VAULT OPENED</p>
      <h1 class="vault-title">ESCAPED</h1>
      <p class="vault-time mono" id="vault-time"></p>
      <button type="button" class="btn btn-amber btn-lg" id="replay-btn">もう一度挑戦する</button>
    </div>
  </div>
`;

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

class App {
  private root: HTMLElement;
  private sfx = new SfxEngine();
  private muted = false;
  private layout: LayoutId = 'us';
  private solvedFlags: boolean[] = PUZZLES.map(() => false);
  private currentIndex = 0;
  private hintVisible = false;
  private startTime = 0;
  private timerHandle: number | undefined;
  private statusClearHandle: number | undefined;

  private lockDial!: LockDial;
  private keyboardView!: KeyboardView;
  private puzzleController!: PuzzleController;

  // DOM refs
  private appHeader!: HTMLElement;
  private screenTitle!: HTMLElement;
  private screenGame!: HTMLElement;
  private vaultOverlay!: HTMLElement;
  private timerEl!: HTMLElement;
  private layoutToggleBtn!: HTMLButtonElement;
  private muteToggleBtn!: HTMLButtonElement;
  private resetBtn!: HTMLButtonElement;
  private startBtn!: HTMLButtonElement;
  private touchBanner!: HTMLElement;
  private puzzleEyebrow!: HTMLElement;
  private puzzleTitle!: HTMLElement;
  private puzzleMode!: HTMLElement;
  private puzzleFlavor!: HTMLElement;
  private puzzleStatus!: HTMLElement;
  private hintBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;
  private solvedBadge!: HTMLElement;
  private bigLockSlot!: HTMLElement;
  private solvedShape!: HTMLElement;
  private replayBtn!: HTMLButtonElement;
  private vaultTime!: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  init(): void {
    this.root.innerHTML = SKELETON;
    this.bindRefs();
    this.detectTouchOnly();

    this.lockDial = new LockDial(document.getElementById('lock-dial')!, PUZZLES.length);
    this.keyboardView = new KeyboardView(document.getElementById('keyboard-grid')!, {
      onActivate: (code, source) => this.handleActivate(code, source),
      onDeactivatePhysical: (code) => this.puzzleController?.deactivatePhysical(code),
    });
    this.keyboardView.setLayout(this.layout);

    this.wireEvents();
    this.updateLayoutButton();
  }

  private bindRefs(): void {
    this.appHeader = document.getElementById('app-header')!;
    this.screenTitle = document.getElementById('screen-title')!;
    this.screenGame = document.getElementById('screen-game')!;
    this.vaultOverlay = document.getElementById('vault-overlay')!;
    this.timerEl = document.getElementById('timer')!;
    this.layoutToggleBtn = document.getElementById('layout-toggle') as HTMLButtonElement;
    this.muteToggleBtn = document.getElementById('mute-toggle') as HTMLButtonElement;
    this.resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
    this.startBtn = document.getElementById('start-btn') as HTMLButtonElement;
    this.touchBanner = document.getElementById('touch-banner')!;
    this.puzzleEyebrow = document.getElementById('puzzle-eyebrow')!;
    this.puzzleTitle = document.getElementById('puzzle-title')!;
    this.puzzleMode = document.getElementById('puzzle-mode')!;
    this.puzzleFlavor = document.getElementById('puzzle-flavor')!;
    this.puzzleStatus = document.getElementById('puzzle-status')!;
    this.hintBtn = document.getElementById('hint-btn') as HTMLButtonElement;
    this.nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
    this.solvedBadge = document.getElementById('solved-badge')!;
    this.bigLockSlot = document.getElementById('big-lock-slot')!;
    this.solvedShape = document.getElementById('solved-shape')!;
    this.replayBtn = document.getElementById('replay-btn') as HTMLButtonElement;
    this.vaultTime = document.getElementById('vault-time')!;
  }

  private detectTouchOnly(): void {
    const touchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (touchOnly) this.touchBanner.hidden = false;
  }

  private wireEvents(): void {
    this.startBtn.addEventListener('click', () => {
      this.sfx.unlock();
      this.startGame();
    });

    this.layoutToggleBtn.addEventListener('click', () => {
      this.sfx.unlock();
      this.layout = this.layout === 'us' ? 'jis' : 'us';
      this.updateLayoutButton();
      // Switching layout clears in-progress input for the current puzzle
      // (esp. mid-trace sequences) but keeps already-solved locks intact.
      this.puzzleController?.reset();
      this.keyboardView.setLayout(this.layout);
      this.hintVisible = false;
      this.setHintButtonLabel();
    });

    this.muteToggleBtn.addEventListener('click', () => {
      this.muted = !this.muted;
      this.sfx.muted = this.muted;
      this.muteToggleBtn.textContent = this.muted ? '♪ OFF' : '♪ ON';
      this.muteToggleBtn.setAttribute('aria-pressed', String(this.muted));
      this.muteToggleBtn.classList.toggle('is-muted', this.muted);
    });

    this.resetBtn.addEventListener('click', () => {
      void this.handleResetRequest();
    });

    this.hintBtn.addEventListener('click', () => {
      this.sfx.unlock();
      this.hintVisible = !this.hintVisible;
      const puzzle = PUZZLES[this.currentIndex]!;
      if (this.hintVisible) {
        this.keyboardView.showHint(puzzle.codes, puzzle.mode === 'sequence');
      } else {
        this.keyboardView.hideHint();
      }
      this.setHintButtonLabel();
    });

    this.nextBtn.addEventListener('click', () => {
      if (this.currentIndex >= PUZZLES.length - 1) {
        this.triggerFinale();
      } else {
        this.loadPuzzle(this.currentIndex + 1);
      }
    });

    this.replayBtn.addEventListener('click', () => {
      this.resetAll();
      this.vaultOverlay.hidden = true;
      this.vaultOverlay.classList.remove('is-open');
      this.screenGame.hidden = false;
    });
  }

  private setHintButtonLabel(): void {
    this.hintBtn.textContent = this.hintVisible ? 'ヒントを消す' : 'ヒント';
  }

  private updateLayoutButton(): void {
    this.layoutToggleBtn.textContent = this.layout.toUpperCase();
    this.layoutToggleBtn.setAttribute('aria-label', `配列: ${this.layout.toUpperCase()}（クリックで切り替え）`);
  }

  private async handleResetRequest(): Promise<void> {
    const ok = await confirmModal(
      '最初からやり直しますか？',
      '解いた錠前の記録もすべて消え、最初の謎から再開します。この操作は取り消せません。',
      'やり直す',
    );
    if (ok) this.resetAll();
  }

  private resetAll(): void {
    this.solvedFlags = PUZZLES.map(() => false);
    for (let i = 0; i < PUZZLES.length; i++) this.lockDial.setState(i, 'locked');
    this.startTime = performance.now();
    this.loadPuzzle(0);
  }

  private startGame(): void {
    this.screenTitle.hidden = true;
    this.screenGame.hidden = false;
    this.appHeader.classList.add('is-visible');
    this.startTime = performance.now();
    this.startTimer();
    this.loadPuzzle(0);
  }

  private startTimer(): void {
    window.clearInterval(this.timerHandle);
    this.timerHandle = window.setInterval(() => {
      this.timerEl.textContent = formatTime(performance.now() - this.startTime);
    }, 500);
  }

  private loadPuzzle(index: number): void {
    this.currentIndex = index;
    const puzzle = PUZZLES[index]!;
    this.hintVisible = false;
    this.setHintButtonLabel();

    this.puzzleEyebrow.textContent = `PROBLEM ${String(puzzle.index).padStart(2, '0')} / ${String(PUZZLES.length).padStart(2, '0')}`;
    this.puzzleTitle.textContent = puzzle.title;
    this.puzzleMode.textContent =
      puzzle.mode === 'simultaneous'
        ? `同時押し ・ 対象 ${puzzle.codes.length} 点`
        : `なぞり（順序あり） ・ 対象 ${puzzle.codes.length} 点`;
    this.puzzleFlavor.textContent = puzzle.flavor;
    this.setStatus('', 'idle');
    this.solvedBadge.hidden = true;
    this.bigLockSlot.innerHTML = '';
    this.hintBtn.hidden = false;
    this.nextBtn.hidden = true;

    this.keyboardView.clearPuzzleState();
    this.puzzleController = new PuzzleController(puzzle, {
      onEngagedChange: (code, engaged) => this.keyboardView.setEngaged(code, engaged),
      onCorrectStep: (code, order) => {
        this.keyboardView.markCorrectStep(code, order);
        this.sfx.stepCorrect();
      },
      onError: (code) => {
        this.keyboardView.flashError(code);
        this.sfx.error();
        this.setStatus('そこではない', 'error');
      },
      onSequenceReset: () => this.keyboardView.clearCorrectSteps(),
      onSolved: () => this.handleSolved(puzzle),
    });

    for (let i = 0; i < PUZZLES.length; i++) {
      if (this.solvedFlags[i]) this.lockDial.setState(i, 'open');
      else if (i === index) this.lockDial.setState(i, 'current');
      else this.lockDial.setState(i, 'locked');
    }
  }

  private handleActivate(code: string, source: KeyActivateSource): void {
    this.sfx.unlock();
    this.sfx.keyTick();
    this.puzzleController?.activate(code, source);
  }

  private handleSolved(puzzle: Puzzle): void {
    this.solvedFlags[this.currentIndex] = true;
    this.lockDial.setState(this.currentIndex, 'open');
    this.sfx.unlockSuccess();
    this.keyboardView.flashSuccess(puzzle.codes);
    this.keyboardView.hideHint();

    this.bigLockSlot.innerHTML = '';
    const lock = createBigLock();
    this.bigLockSlot.append(lock);
    requestAnimationFrame(() => lock.classList.add('open'));

    this.solvedShape.textContent = `FORM: ${puzzle.shapeName}`;
    this.solvedBadge.hidden = false;
    this.hintBtn.hidden = true;
    this.nextBtn.hidden = false;
    this.nextBtn.textContent = this.currentIndex >= PUZZLES.length - 1 ? '金庫を開ける' : '次へ';
    this.nextBtn.focus();
    this.setStatus('開錠成功', 'success');
  }

  private setStatus(text: string, kind: 'idle' | 'error' | 'success'): void {
    window.clearTimeout(this.statusClearHandle);
    this.puzzleStatus.textContent = text;
    this.puzzleStatus.className = `puzzle-status mono status-${kind}`;
    if (kind === 'error') {
      this.statusClearHandle = window.setTimeout(() => this.setStatus('', 'idle'), 1400);
    }
  }

  private triggerFinale(): void {
    window.clearInterval(this.timerHandle);
    const elapsed = formatTime(performance.now() - this.startTime);
    this.vaultTime.textContent = `所要時間 ${elapsed}`;
    this.screenGame.hidden = true;
    this.vaultOverlay.hidden = false;
    this.sfx.finale();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.vaultOverlay.classList.add('is-open'));
    });
  }
}

const rootEl = document.getElementById('app');
if (rootEl) {
  new App(rootEl).init();
}
