import './style.css';
import { createInitialState, reduce, type GameState, type Event, type HistoryEntry } from './state';
import type { Question } from './questions';
import type { JudgeResult } from './judge';

const CATEGORY_LABEL: Record<Question['category'], string> = {
  number: '数字あて',
  text: '自由記述',
  choice: '2択',
};

const PLAYER_LABEL: Record<1 | 2, string> = { 1: 'P1', 2: 'P2' };

let state: GameState = createInitialState();
let historyOpen = false;
let countdownTimer: ReturnType<typeof setTimeout> | null = null;
let inputError: string | null = null;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('#app root element not found');
}

function dispatch(event: Event): void {
  const prevScreen = state.screen;
  inputError = null;
  state = reduce(state, event);
  render();
  if (state.screen === 'countdown' && prevScreen !== 'countdown') {
    scheduleCountdown();
  }
}

function scheduleCountdown(): void {
  if (countdownTimer !== null) {
    clearTimeout(countdownTimer);
  }
  // 3 -> 2 -> 1 -> せーの! の演出時間ぶん待ってから公開処理に進む
  countdownTimer = setTimeout(() => {
    countdownTimer = null;
    dispatch({ type: 'COUNTDOWN_DONE' });
  }, 2400);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderHeader(): HTMLElement {
  const header = el('header', 'score-bar');

  const roundBlock = el('div', 'score-bar__cell');
  roundBlock.append(el('span', 'score-bar__label', 'ROUND'), el('span', 'score-bar__value', String(state.roundNumber || 0).padStart(2, '0')));

  const scoreBlock = el('div', 'score-bar__cell');
  scoreBlock.append(el('span', 'score-bar__label', 'SCORE'), el('span', 'score-bar__value', String(state.score)));

  const streakBlock = el('div', `score-bar__cell${state.streak >= 2 ? ' score-bar__cell--hot' : ''}`);
  streakBlock.append(
    el('span', 'score-bar__label', 'あうんストリーク'),
    el('span', 'score-bar__value', `x${state.streak}`),
  );

  header.append(roundBlock, scoreBlock, streakBlock);

  if (state.screen !== 'title') {
    const resetBtn = el('button', 'reset-btn', '最初から');
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', () => {
      if (window.confirm('スコア・ストリーク・履歴をリセットして最初からはじめますか？')) {
        historyOpen = false;
        dispatch({ type: 'RESET' });
      }
    });
    header.append(resetBtn);
  }

  return header;
}

function renderTitle(): HTMLElement {
  const wrap = el('section', 'screen screen--title');
  wrap.append(el('p', 'kicker', 'PASS & REVEAL PARTY GAME'));
  wrap.append(el('h1', 'title-logo', 'せーのテレパシー'));
  wrap.append(el('p', 'title-sub', 'SYNC REVEAL PARTY'));

  const desc = el('p', 'title-desc');
  desc.textContent = '1台の端末を2人で回し使い。お題に隠して答えを入力し、「せーの」で同時公開。一致度とあうんストリークで勝負しよう。';
  wrap.append(desc);

  const rules = el('ol', 'title-rules');
  [
    'お題を2人で確認する',
    'P1がこっそり回答（画面を隠す）',
    '端末をP2へ手渡す',
    'P2がこっそり回答（画面を隠す）',
    '「せーの」で同時公開！',
  ].forEach((step) => {
    rules.append(el('li', undefined, step));
  });
  wrap.append(rules);

  const bestBoard = el('div', 'best-board');
  const bestScore = el('div', 'best-board__item');
  bestScore.append(el('span', 'best-board__label', 'BEST SCORE'), el('span', 'best-board__value', String(state.records.bestScore)));
  const bestStreak = el('div', 'best-board__item');
  bestStreak.append(el('span', 'best-board__label', 'BEST ストリーク'), el('span', 'best-board__value', `x${state.records.bestStreak}`));
  bestBoard.append(bestScore, bestStreak);
  wrap.append(bestBoard);

  const startBtn = el('button', 'btn btn--accent btn--block btn--xl', 'はじめる');
  startBtn.type = 'button';
  startBtn.addEventListener('click', () => dispatch({ type: 'START_ROUND' }));
  wrap.append(startBtn);

  return wrap;
}

function renderPrompt(question: Question): HTMLElement {
  const wrap = el('section', 'screen screen--prompt');
  wrap.append(el('p', 'meta-tag', `お題 #${String(state.roundNumber).padStart(2, '0')} / ${CATEGORY_LABEL[question.category]}`));
  wrap.append(el('h2', 'prompt-text', question.prompt));

  if (question.category === 'choice') {
    const opts = el('p', 'prompt-hint', `選択肢: ${question.optionA} / ${question.optionB}`);
    wrap.append(opts);
  } else if (question.category === 'number') {
    wrap.append(el('p', 'prompt-hint', `${question.min}〜${question.max} の数字で答えてね`));
  }

  wrap.append(el('p', 'prompt-note', 'まずは2人でこのお題を確認しよう。次に P1 がこっそり回答するよ。'));

  const beginBtn = el('button', 'btn btn--p1 btn--block btn--xl', 'P1が回答する →');
  beginBtn.type = 'button';
  beginBtn.addEventListener('click', () => dispatch({ type: 'BEGIN_INPUT' }));
  wrap.append(beginBtn);

  return wrap;
}

function renderInput(question: Question, player: 1 | 2): HTMLElement {
  const wrap = el('section', `screen screen--input player-theme--${player === 1 ? 'p1' : 'p2'}`);

  wrap.append(el('p', 'meta-tag', `${PLAYER_LABEL[player]} の番`));
  wrap.append(el('div', 'privacy-banner', '⚠ 画面を相手に見せないでください'));
  wrap.append(el('h2', 'prompt-text prompt-text--small', question.prompt));

  const form = el('form', 'input-form');
  form.addEventListener('submit', (e) => e.preventDefault());

  if (inputError) {
    form.append(el('p', 'input-error', inputError));
  }

  const submitAnswer = (raw: string): void => {
    if (player === 1) {
      dispatch({ type: 'SUBMIT_P1', answer: raw });
    } else {
      dispatch({ type: 'SUBMIT_P2', answer: raw });
    }
  };

  if (question.category === 'choice') {
    const optionsWrap = el('div', 'choice-options');
    const makeOptionBtn = (label: string): HTMLButtonElement => {
      const btn = el('button', 'btn btn--choice btn--block', label);
      btn.type = 'button';
      btn.addEventListener('click', () => submitAnswer(label));
      return btn;
    };
    optionsWrap.append(makeOptionBtn(question.optionA), makeOptionBtn(question.optionB));
    form.append(optionsWrap);
    form.append(el('p', 'prompt-hint', 'タップすると即座に答えが確定します（誰にも表示されません）'));
  } else {
    const maskField = el('div', 'mask-field');
    const input = el('input', 'mask-field__input');
    input.type = 'password';
    input.autocomplete = 'off';
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    if (question.category === 'number') {
      input.inputMode = 'numeric';
      input.pattern = '[0-9]*';
      input.placeholder = `${question.min}〜${question.max}`;
      input.maxLength = 3;
    } else {
      input.inputMode = 'text';
      input.placeholder = '答えを入力(伏せ字表示)';
      input.maxLength = 40;
    }
    maskField.append(input);
    form.append(maskField);

    const submitBtn = el(
      'button',
      `btn btn--block btn--xl ${player === 1 ? 'btn--p1' : 'btn--p2'}`,
      'この答えで確定',
    );
    submitBtn.type = 'submit';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = input.value.trim();
      if (question.category === 'number') {
        const n = Number(raw);
        if (raw === '' || !Number.isInteger(n) || n < question.min || n > question.max) {
          inputError = `${question.min}〜${question.max} の整数を入力してください`;
          render();
          return;
        }
        submitAnswer(String(n));
      } else {
        if (raw.length === 0) {
          inputError = '1文字以上入力してください';
          render();
          return;
        }
        submitAnswer(raw);
      }
    });
    form.append(submitBtn);

    // 描画直後にフォーカスして入力しやすくする
    requestAnimationFrame(() => input.focus());
  }

  wrap.append(form);
  return wrap;
}

function renderHandoff(question: Question, toPlayer: 1 | 2): HTMLElement {
  const wrap = el('section', `screen screen--handoff player-theme--${toPlayer === 1 ? 'p1' : 'p2'}`);
  wrap.append(el('p', 'meta-tag', 'HAND OFF'));

  const card = el('div', 'flip-card');
  card.append(el('p', 'flip-card__done', `${PLAYER_LABEL[toPlayer === 1 ? 2 : 1]} の回答を受け付けました`));
  card.append(el('h2', 'flip-card__headline', '端末を手渡してください'));
  card.append(el('p', 'flip-card__arrow', '→'));
  card.append(el('p', 'flip-card__target', `次は ${PLAYER_LABEL[toPlayer]} の番です`));
  wrap.append(card);

  const confirmBtn = el(
    'button',
    `btn btn--block btn--xl ${toPlayer === 1 ? 'btn--p1' : 'btn--p2'}`,
    `渡しました（自分が ${PLAYER_LABEL[toPlayer]}）`,
  );
  confirmBtn.type = 'button';
  confirmBtn.addEventListener('click', () => dispatch({ type: 'CONFIRM_HANDOFF' }));
  wrap.append(confirmBtn);
  void question;
  return wrap;
}

function renderCountdown(): HTMLElement {
  const wrap = el('section', 'screen screen--countdown');
  wrap.append(el('p', 'meta-tag', '両者の回答がそろいました'));
  const stage = el('div', 'countdown-stage');
  stage.append(el('span', 'countdown-word', 'せーの'));
  stage.append(el('span', 'countdown-word countdown-word--exclaim', 'の...!'));
  wrap.append(stage);
  wrap.append(el('p', 'prompt-hint', '同時公開の準備中...'));
  return wrap;
}

function tierClass(judge: JudgeResult): string {
  if (judge.tier === 2) return 'tier-hit';
  if (judge.tier === 1) return 'tier-near';
  return 'tier-miss';
}

function renderReveal(question: Question, answerP1: string, answerP2: string): HTMLElement {
  const result = state.lastResult;
  const wrap = el('section', `screen screen--reveal ${result ? tierClass(result.judge) : ''}`);

  wrap.append(el('p', 'meta-tag', `お題 #${String(state.roundNumber).padStart(2, '0')}: ${question.prompt}`));

  const answers = el('div', 'reveal-answers');
  const p1Block = el('div', 'reveal-answers__block reveal-answers__block--p1');
  p1Block.append(el('span', 'reveal-answers__label', 'P1'), el('span', 'reveal-answers__value', answerP1));
  const p2Block = el('div', 'reveal-answers__block reveal-answers__block--p2');
  p2Block.append(el('span', 'reveal-answers__label', 'P2'), el('span', 'reveal-answers__value', answerP2));
  answers.append(p1Block, p2Block);
  wrap.append(answers);

  if (result) {
    wrap.append(el('h2', 'judge-label', result.judge.label));

    const scoreLine = el('p', 'judge-score');
    scoreLine.textContent = `+${result.roundScore}点 (基礎点 x${result.multiplier.toFixed(1)})`;
    wrap.append(scoreLine);

    if (result.newStreak >= 2) {
      wrap.append(el('p', 'streak-chip', `🔥 あうんストリーク x${result.newStreak} 継続中！`));
    } else if (result.streakBroken) {
      wrap.append(el('p', 'streak-broken', 'ストリークが途切れました…次で仕切り直し！'));
    }

    if (state.justUpdatedBest.score || state.justUpdatedBest.streak) {
      const bestFlash = el('p', 'best-flash');
      const parts: string[] = [];
      if (state.justUpdatedBest.score) parts.push('SCORE');
      if (state.justUpdatedBest.streak) parts.push('STREAK');
      bestFlash.textContent = `NEW BEST! (${parts.join(' & ')})`;
      wrap.append(bestFlash);
    }
  }

  const nextBtn = el('button', 'btn btn--accent btn--block btn--xl', '次のお題へ');
  nextBtn.type = 'button';
  nextBtn.addEventListener('click', () => dispatch({ type: 'NEXT_ROUND' }));
  wrap.append(nextBtn);

  const historyBtn = el('button', 'btn btn--ghost btn--block', `履歴を見る (${state.history.length})`);
  historyBtn.type = 'button';
  historyBtn.addEventListener('click', () => {
    historyOpen = true;
    render();
  });
  wrap.append(historyBtn);

  return wrap;
}

function renderHistoryEntry(entry: HistoryEntry): HTMLElement {
  const row = el('li', 'history-row');
  row.append(el('span', 'history-row__round', `#${String(entry.roundNumber).padStart(2, '0')}`));
  const body = el('div', 'history-row__body');
  body.append(el('p', 'history-row__prompt', entry.question.prompt));
  body.append(el('p', 'history-row__answers', `P1: ${entry.answerP1}　/　P2: ${entry.answerP2}`));
  const resultLine = el('p', `history-row__result ${tierClass(entry.judge)}`);
  resultLine.textContent = `${entry.judge.label} ・ +${entry.roundScore}点`;
  body.append(resultLine);
  row.append(body);
  return row;
}

function renderHistoryOverlay(): HTMLElement {
  const overlay = el('div', 'history-overlay');
  const panel = el('div', 'history-panel');
  const head = el('div', 'history-panel__head');
  head.append(el('h2', 'history-panel__title', '直近の履歴'));
  const closeBtn = el('button', 'btn btn--ghost', '閉じる');
  closeBtn.type = 'button';
  closeBtn.addEventListener('click', () => {
    historyOpen = false;
    render();
  });
  head.append(closeBtn);
  panel.append(head);

  if (state.history.length === 0) {
    panel.append(el('p', 'history-empty', 'まだ履歴がありません'));
  } else {
    const list = el('ul', 'history-list');
    state.history.forEach((entry) => list.append(renderHistoryEntry(entry)));
    panel.append(list);
  }

  overlay.append(panel);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      historyOpen = false;
      render();
    }
  });
  return overlay;
}

function renderScreen(): HTMLElement {
  switch (state.screen) {
    case 'title':
      return renderTitle();
    case 'prompt':
      if (!state.question) return renderTitle();
      return renderPrompt(state.question);
    case 'input':
      if (!state.question) return renderTitle();
      return renderInput(state.question, state.activePlayer);
    case 'handoff':
      if (!state.question) return renderTitle();
      return renderHandoff(state.question, state.handoffTo);
    case 'countdown':
      return renderCountdown();
    case 'reveal':
      if (!state.question || state.answerP1 === null || state.answerP2 === null) return renderTitle();
      return renderReveal(state.question, state.answerP1, state.answerP2);
    default:
      return renderTitle();
  }
}

function render(): void {
  if (!app) return;
  app.innerHTML = '';

  const stage = el('div', 'stage');
  const board = el('div', 'board');

  board.append(renderHeader());
  const body = el('div', 'board__body');
  body.append(renderScreen());
  board.append(body);

  stage.append(board);
  app.append(stage);

  if (historyOpen) {
    app.append(renderHistoryOverlay());
  }
}

render();
