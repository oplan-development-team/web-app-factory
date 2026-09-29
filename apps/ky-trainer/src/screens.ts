import { clearRoot, h } from './dom';
import { copyToClipboard } from './clipboard';
import { CountdownTimer } from './timer';
import { QUESTION_TIME_MS, tierForAccuracy, type GameSession, type AnswerResult } from './game';
import type { AnswerOutcome, BestRecord, Scenario } from './types';

export type ScreenCleanup = () => void;

const NO_RECORD_LABEL = '記録なし';

function formatBestValue(value: number | undefined, suffix: string): string {
  if (value === undefined || value <= 0) return NO_RECORD_LABEL;
  return `${value}${suffix}`;
}

function buildCharacter(face: 'neutral' | 'correct' | 'wrong'): HTMLDivElement {
  const character = h('div', { class: `character character--${face}` });
  character.append(
    h('span', { class: 'character__eye character__eye--left' }),
    h('span', { class: 'character__eye character__eye--right' }),
    h('span', { class: 'character__mouth' }),
  );
  if (face === 'correct') {
    character.append(
      h('span', { class: 'character__fx character__fx--heart', text: '♥' }),
      h('span', { class: 'character__fx character__fx--heart character__fx--heart-2', text: '♥' }),
      h('span', { class: 'character__fx character__fx--petal', text: '❀' }),
    );
  }
  if (face === 'wrong') {
    character.append(h('div', { class: 'character__crack', attrs: { 'aria-hidden': 'true' } }));
  }
  return character;
}

// ─────────────────────────────────────────────
// スタート画面
// ─────────────────────────────────────────────
export function renderStartScreen(
  root: HTMLElement,
  bestRecord: BestRecord | null,
  onStart: () => void,
): ScreenCleanup {
  clearRoot(root);

  const screen = h('div', { class: 'screen screen--start halftone' });

  const titleStamp = h('header', { class: 'stamp-title' }, [
    h('h1', { class: 'stamp-title__text' }, ['空気読み', h('br'), 'トレーニング']),
    h('p', { class: 'stamp-title__sub mono', text: 'KY TRAINER' }),
  ]);

  const introPanel = h('div', { class: 'panel intro-panel' }, [
    h('p', {
      class: 'intro-panel__lead',
      text: '日本語特有の「空気を読む」シチュエーションが次々登場。制限時間12秒の4択で、一番場が丸く収まる返答を選ぼう。',
    }),
    h('ul', { class: 'intro-panel__rules' }, [
      h('li', { text: '各問12秒。時間切れは自動的に不正解あつかい' }),
      h('li', { text: '連続正解でストリークが伸びる、全20問勝負' }),
    ]),
  ]);

  const recordPanel = h('div', { class: 'panel record-panel' }, [
    h('p', { class: 'record-panel__label', text: '自己ベスト' }),
    h('div', { class: 'record-panel__row' }, [
      h('span', { text: 'スコア' }),
      h('span', { class: 'mono', text: formatBestValue(bestRecord?.bestScore, '点') }),
    ]),
    h('div', { class: 'record-panel__row' }, [
      h('span', { text: '最高ストリーク' }),
      h('span', { class: 'mono', text: formatBestValue(bestRecord?.bestStreak, '連続') }),
    ]),
  ]);

  const startButton = h('button', {
    class: 'cta-button',
    text: 'はじめる',
    attrs: { type: 'button' },
  });
  const handleStart = () => onStart();
  startButton.addEventListener('click', handleStart);

  screen.append(
    h('div', { class: 'paper-frame paper-frame--start' }, [
      titleStamp,
      introPanel,
      recordPanel,
      h('div', { class: 'cta-row' }, [startButton]),
    ]),
  );

  root.append(screen);

  return () => {
    startButton.removeEventListener('click', handleStart);
  };
}

// ─────────────────────────────────────────────
// 出題画面
// ─────────────────────────────────────────────
export function renderQuestionScreen(
  root: HTMLElement,
  scenario: Scenario,
  questionNumber: number,
  total: number,
  currentStreak: number,
  onAnswer: (chosenIndex: number | null, remainingMs: number, outcome: AnswerOutcome) => void,
): ScreenCleanup {
  clearRoot(root);

  let settled = false;
  const timer = new CountdownTimer(
    QUESTION_TIME_MS,
    (remainingMs, progress) => updateTimerUI(remainingMs, progress),
    () => {
      if (settled) return;
      settle(null);
    },
  );

  const screen = h('div', { class: 'screen screen--question halftone' });

  const progressRow = h('div', { class: 'q-progress' }, [
    h('span', { class: 'q-progress__category', text: scenario.category }),
    h('span', { class: 'q-progress__count mono', text: `${questionNumber} / ${total}` }),
    h(
      'span',
      { class: `q-progress__streak${currentStreak > 0 ? ' is-active' : ''}` },
      [`🔥 ${currentStreak}連続`],
    ),
  ]);

  const character = buildCharacter('neutral');
  const introKoma = h('div', { class: 'panel intro-koma' }, [
    character,
    h('div', { class: 'intro-koma__icon', attrs: { 'aria-hidden': 'true' }, text: scenario.icon }),
    h('p', { class: 'intro-koma__text', text: scenario.situation }),
  ]);

  const ringProgressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ringProgressCircle.setAttribute('class', 'timer-ring__progress');
  ringProgressCircle.setAttribute('cx', '50');
  ringProgressCircle.setAttribute('cy', '50');
  ringProgressCircle.setAttribute('r', '42');

  const ringTrackCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ringTrackCircle.setAttribute('class', 'timer-ring__track');
  ringTrackCircle.setAttribute('cx', '50');
  ringTrackCircle.setAttribute('cy', '50');
  ringTrackCircle.setAttribute('r', '42');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'timer-ring');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.append(ringTrackCircle, ringProgressCircle);

  const timerValue = h('span', { class: 'timer-ring__value mono', text: '12' });
  const timerWrap = h('div', { class: 'timer-row' }, [
    h('div', { class: 'timer-ring-wrap' }, [svg, timerValue]),
    h('div', { class: 'speed-lines', attrs: { 'aria-hidden': 'true' } }),
  ]);

  const CIRCUMFERENCE = 2 * Math.PI * 42;
  ringProgressCircle.style.strokeDasharray = `${CIRCUMFERENCE}`;

  function updateTimerUI(remainingMs: number, progress: number) {
    const secondsLeft = Math.ceil(remainingMs / 1000);
    timerValue.textContent = `${secondsLeft}`;
    ringProgressCircle.style.strokeDashoffset = `${CIRCUMFERENCE * progress}`;
    const urgent = remainingMs <= 4000;
    timerWrap.classList.toggle('is-urgent', urgent);
    screen.classList.toggle('is-urgent', urgent);
  }

  const choiceButtons: HTMLButtonElement[] = [];
  const choicesGrid = h('div', { class: 'choices-grid' });
  scenario.choices.forEach((choiceText, index) => {
    const button = h('button', {
      class: 'choice-btn',
      attrs: { type: 'button', 'data-index': String(index) },
    });
    button.append(
      h('span', { class: 'choice-btn__marker', text: String.fromCharCode(65 + index) }),
      h('span', { class: 'choice-btn__label', text: choiceText }),
    );
    const handler = () => {
      if (settled) return;
      settle(index);
    };
    button.addEventListener('click', handler);
    choiceButtons.push(button);
    choicesGrid.append(button);
  });

  function settle(chosenIndex: number | null) {
    settled = true;
    const remainingMs = timer.getRemainingMs();
    timer.cancel();
    choiceButtons.forEach((btn) => (btn.disabled = true));
    const outcome: AnswerOutcome =
      chosenIndex === null ? 'timeout' : chosenIndex === scenario.correctIndex ? 'correct' : 'wrong';
    if (chosenIndex !== null) {
      choiceButtons[chosenIndex].classList.add('is-chosen');
    }
    onAnswer(chosenIndex, remainingMs, outcome);
  }

  screen.append(progressRow, introKoma, timerWrap, choicesGrid);
  root.append(screen);
  timer.start();

  return () => {
    timer.cancel();
    choiceButtons.forEach((btn) => btn.replaceWith(btn.cloneNode(true)));
  };
}

// ─────────────────────────────────────────────
// 結果コマ画面
// ─────────────────────────────────────────────
interface ResultContent {
  stamp: string;
  verdict: string;
  chosenText: string;
  explanation: string;
}

function buildResultContent(scenario: Scenario, chosenIndex: number | null, outcome: AnswerOutcome): ResultContent {
  if (outcome === 'correct' && chosenIndex !== null) {
    return {
      stamp: 'ピキーン!',
      verdict: '正解! 場がほわっと丸く収まった',
      chosenText: scenario.choices[chosenIndex],
      explanation: scenario.explanations[chosenIndex],
    };
  }
  if (outcome === 'wrong' && chosenIndex !== null) {
    return {
      stamp: 'シーン……',
      verdict: '不正解… 場の空気が凍りついた',
      chosenText: scenario.choices[chosenIndex],
      explanation: scenario.explanations[chosenIndex],
    };
  }
  return {
    stamp: 'シーン……',
    verdict: '時間切れ… 固まっている間に空気が凍りついた',
    chosenText: '(何も言えなかった)',
    explanation: `正解は「${scenario.choices[scenario.correctIndex]}」。${scenario.explanations[scenario.correctIndex]}`,
  };
}

export function renderResultScreen(
  root: HTMLElement,
  scenario: Scenario,
  chosenIndex: number | null,
  result: AnswerResult,
  onContinue: () => void,
): ScreenCleanup {
  clearRoot(root);

  const isCorrect = result.outcome === 'correct';
  const content = buildResultContent(scenario, chosenIndex, result.outcome);

  const screen = h('div', {
    class: `screen screen--result ${isCorrect ? 'is-correct' : 'is-wrong'} halftone`,
  });

  const character = buildCharacter(isCorrect ? 'correct' : 'wrong');

  const resultKoma = h('div', { class: 'panel result-koma' }, [
    h('div', { class: 'result-koma__stamp', text: content.stamp }),
    character,
    h('p', { class: 'result-koma__verdict', text: content.verdict }),
    h('p', { class: 'result-koma__chosen', text: `あなたの返答: 「${content.chosenText}」` }),
    h('p', { class: 'result-koma__explanation', text: content.explanation }),
  ]);

  if (result.comboMilestone) {
    resultKoma.append(
      h('div', { class: 'combo-badge', text: `${result.comboMilestone}連続コンボ!!` }),
    );
  }

  if (isCorrect) {
    resultKoma.append(h('p', { class: 'result-koma__score mono', text: `+${result.pointsEarned}点` }));
  }

  const hint = h('p', { class: 'result-koma__hint', text: 'タップで次のコマへ' });

  screen.append(resultKoma, hint);
  root.append(screen);

  let advanced = false;
  const AUTO_ADVANCE_MS = 2600;
  const timeoutId = window.setTimeout(() => proceed(), AUTO_ADVANCE_MS);

  function proceed() {
    if (advanced) return;
    advanced = true;
    onContinue();
  }

  const handleTap = () => proceed();
  screen.addEventListener('click', handleTap);

  return () => {
    window.clearTimeout(timeoutId);
    screen.removeEventListener('click', handleTap);
  };
}

// ─────────────────────────────────────────────
// 最終結果画面
// ─────────────────────────────────────────────
export function renderFinalScreen(
  root: HTMLElement,
  session: GameSession,
  bestRecord: BestRecord,
  previousBest: BestRecord | null,
  onRestart: () => void,
): ScreenCleanup {
  clearRoot(root);

  const accuracy = session.accuracyPercent;
  const tier = tierForAccuracy(accuracy);
  const isNewBestScore = session.score > 0 && session.score >= bestRecord.bestScore && session.score > (previousBest?.bestScore ?? 0);
  const isNewBestStreak = session.maxStreak > 0 && session.maxStreak > (previousBest?.bestStreak ?? 0);

  const screen = h('div', { class: 'screen screen--final halftone' });

  const titlePanel = h('div', { class: 'panel final-title-panel' }, [
    h('h1', { class: 'final-title', text: '結果発表' }),
  ]);

  const tierPanel = h('div', { class: 'panel tier-panel' }, [
    h('p', { class: 'tier-panel__label', text: 'あなたの空気読みレベル' }),
    h('p', { class: 'tier-panel__badge', text: tier.title }),
    h('p', { class: 'tier-panel__blurb', text: tier.blurb }),
  ]);

  function statTile(label: string, value: string, badge?: string) {
    const tile = h('div', { class: 'stat-tile' }, [
      h('span', { class: 'stat-tile__label', text: label }),
      h('span', { class: 'stat-tile__value mono', text: value }),
    ]);
    if (badge) tile.append(h('span', { class: 'stat-tile__badge', text: badge }));
    return tile;
  }

  const statsGrid = h('div', { class: 'stats-grid' }, [
    statTile('総合スコア', `${session.score}点`, isNewBestScore ? '新記録!' : undefined),
    statTile('正答数', `${session.correctCount} / ${session.total}`),
    statTile('最高ストリーク', `${session.maxStreak}連続`, isNewBestStreak ? '新記録!' : undefined),
    statTile('正答率', `${accuracy}%`),
  ]);

  const recordPanel = h('div', { class: 'panel record-panel' }, [
    h('p', { class: 'record-panel__label', text: '自己ベスト(更新後)' }),
    h('div', { class: 'record-panel__row' }, [
      h('span', { text: 'スコア' }),
      h('span', { class: 'mono', text: formatBestValue(bestRecord.bestScore, '点') }),
    ]),
    h('div', { class: 'record-panel__row' }, [
      h('span', { text: '最高ストリーク' }),
      h('span', { class: 'mono', text: formatBestValue(bestRecord.bestStreak, '連続') }),
    ]),
  ]);

  const restartButton = h('button', {
    class: 'cta-button',
    text: 'もう一度挑戦',
    attrs: { type: 'button' },
  });
  const copyButton = h('button', {
    class: 'cta-button cta-button--outline',
    text: '結果をコピー',
    attrs: { type: 'button' },
  });

  const copyFallback = h('div', { class: 'copy-fallback', attrs: { hidden: 'true' } });
  const fallbackTextarea = h('textarea', {
    class: 'copy-fallback__textarea',
    attrs: { readonly: 'true', rows: '3' },
  }) as HTMLTextAreaElement;
  copyFallback.append(
    h('p', {
      class: 'copy-fallback__note',
      text: '自動コピーできませんでした。下のテキストを選択してコピーしてください。',
    }),
    fallbackTextarea,
  );

  const shareText = `空気読みトレーニングで「${tier.title}」を達成!\nスコア${session.score}点(${session.total}問中${session.correctCount}問正解/正答率${accuracy}%)、最高ストリーク${session.maxStreak}連続`;

  let copyResetTimeoutId: number | null = null;
  const handleCopy = async () => {
    const result = await copyToClipboard(shareText);
    if (copyResetTimeoutId !== null) window.clearTimeout(copyResetTimeoutId);
    if (result === 'copied') {
      copyButton.textContent = 'コピーしました!';
      copyFallback.hidden = true;
      copyResetTimeoutId = window.setTimeout(() => {
        copyButton.textContent = '結果をコピー';
      }, 1800);
    } else {
      fallbackTextarea.value = shareText;
      copyFallback.hidden = false;
      fallbackTextarea.focus();
      fallbackTextarea.select();
    }
  };
  const handleRestart = () => onRestart();

  copyButton.addEventListener('click', handleCopy);
  restartButton.addEventListener('click', handleRestart);

  const actions = h('div', { class: 'final-actions' }, [restartButton, copyButton]);

  screen.append(titlePanel, tierPanel, statsGrid, recordPanel, actions, copyFallback);
  root.append(screen);

  return () => {
    copyButton.removeEventListener('click', handleCopy);
    restartButton.removeEventListener('click', handleRestart);
    if (copyResetTimeoutId !== null) window.clearTimeout(copyResetTimeoutId);
  };
}
