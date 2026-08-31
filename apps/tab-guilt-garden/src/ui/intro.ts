import { speciesSvg } from '../domain/species';

export interface IntroHandlers {
  onDismiss(): void;
}

interface Step {
  ordinal: string;
  title: string;
  body: string;
  stage: string;
  species: 'flower' | 'cactus' | 'mushroom' | 'tree';
}

/**
 * Three steps, illustrated with the same plant artwork the garden uses, so the
 * legend and the real thing read as one system.
 */
const STEPS: Step[] = [
  {
    ordinal: '01',
    title: 'タブを開くと苗が生える',
    body: 'このページを開いたタブ1本につき、庭に苗が1本生えます。何個も開けば、その全部が1つの庭に並びます。',
    stage: 'leaf',
    species: 'flower',
  },
  {
    ordinal: '02',
    title: '放置するとしおれる',
    body: 'そのタブから離れている実時間ぶんだけ苗はしおれ、やがて枯れます。タブに戻れば回復します。',
    stage: 'wilt',
    species: 'mushroom',
  },
  {
    ordinal: '03',
    title: '閉じると墓標が残る',
    body: 'タブを閉じると苗は墓地へ移り、生きた時間と最期の放置時間が記録として残り続けます。',
    stage: 'dead',
    species: 'tree',
  },
];

/**
 * The first-run explainer. Deliberately not a blocking modal: the garden itself
 * is the best explanation, so covering it up would be counterproductive.
 */
export function renderIntro(el: HTMLElement, handlers: IntroHandlers): void {
  el.innerHTML = '';
  el.hidden = false;

  const head = document.createElement('div');
  head.className = 'intro-head';

  const title = document.createElement('h2');
  title.className = 'intro-title';
  title.textContent = 'これは何？';

  const lede = document.createElement('p');
  lede.className = 'intro-lede';
  lede.textContent =
    '開きっぱなしのタブを、庭の苗に見立てて可視化する自虐ジョークです。放置した実時間ぶんだけ苗は弱っていきます。';

  head.append(title, lede);

  const steps = document.createElement('ol');
  steps.className = 'intro-steps';
  for (const s of STEPS) {
    steps.appendChild(buildStep(s));
  }

  const foot = document.createElement('div');
  foot.className = 'intro-foot';

  const note = document.createElement('p');
  note.className = 'intro-note mono';
  note.textContent =
    'サーバー・アカウントなし。記録はこのブラウザの中だけに保存され、他の端末とは同期しません。';

  const dismiss = document.createElement('button');
  dismiss.className = 'btn btn-mustard';
  dismiss.type = 'button';
  dismiss.textContent = 'わかった、庭を見る';
  dismiss.addEventListener('click', () => {
    hideIntro(el);
    handlers.onDismiss();
  });

  foot.append(note, dismiss);
  el.append(head, steps, foot);
}

function buildStep(s: Step): HTMLElement {
  const item = document.createElement('li');
  item.className = 'intro-step';
  item.dataset.stage = s.stage;

  const ordinal = document.createElement('span');
  ordinal.className = 'intro-step-ordinal mono';
  ordinal.textContent = s.ordinal;

  const art = document.createElement('div');
  // stage-tint (not plant-card) so the artwork picks up the stage palette
  // without joining every .plant-card selector and query in the app.
  art.className = 'intro-step-art stage-tint';
  art.dataset.stage = s.stage;
  art.innerHTML = speciesSvg(s.species);

  const title = document.createElement('p');
  title.className = 'intro-step-title';
  title.textContent = s.title;

  const body = document.createElement('p');
  body.className = 'intro-step-body';
  body.textContent = s.body;

  item.append(ordinal, art, title, body);
  return item;
}

export function hideIntro(el: HTMLElement): void {
  el.hidden = true;
  el.innerHTML = '';
}

export function isIntroVisible(el: HTMLElement): boolean {
  return !el.hidden;
}
