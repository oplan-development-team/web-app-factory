import { ACHIEVEMENTS } from '../domain/achievements';
import { formatNeglect } from '../domain/format';
import { rankProgress } from '../domain/rank';
import type { LifetimeLedger } from '../domain/types';

export interface ScoreboardInput {
  ledger: LifetimeLedger;
  aliveCount: number;
  graveyardCount: number;
}

interface StatBlock {
  cls: string;
  label: string;
  value: string;
  sub?: string;
}

/**
 * The at-a-glance numbers. Totals come from the lifetime ledger rather than the
 * current garden, so burning the plot does not appear to undo your progress.
 */
export function renderStats(el: HTMLElement, input: ScoreboardInput): void {
  el.innerHTML = '';

  const { ledger, aliveCount, graveyardCount } = input;

  const blocks: StatBlock[] = [
    {
      cls: 'stat-total',
      label: '通算植栽数',
      value: String(ledger.totalPlanted),
      sub: 'これまで芽吹いた罪',
    },
    { cls: 'stat-alive', label: '現在生存', value: String(aliveCount) },
    { cls: 'stat-grave', label: '墓標', value: String(graveyardCount) },
    {
      cls: 'stat-record',
      label: '最長放置記録',
      value: ledger.longestNeglectMs > 0 ? formatNeglect(ledger.longestNeglectMs) : '—',
    },
  ];

  for (const b of blocks) {
    el.appendChild(buildStatBlock(b));
  }
}

function buildStatBlock(b: StatBlock): HTMLElement {
  const card = document.createElement('div');
  card.className = `stat-block ${b.cls}`;

  const value = document.createElement('p');
  value.className = 'stat-value';
  value.textContent = b.value;

  const label = document.createElement('p');
  label.className = 'stat-label';
  label.textContent = b.label;

  card.append(value, label);

  if (b.sub) {
    const sub = document.createElement('p');
    sub.className = 'stat-sub';
    sub.textContent = b.sub;
    card.appendChild(sub);
  }

  return card;
}

/**
 * The rank ladder with an explicit "how far to the next one" readout. Without a
 * visible target the idle loop has nothing to pull the player forward.
 */
export function renderRank(el: HTMLElement, ledger: LifetimeLedger): void {
  el.innerHTML = '';

  const progress = rankProgress(ledger);

  const heading = document.createElement('p');
  heading.className = 'rank-eyebrow mono';
  heading.textContent = '現在の階級';

  const name = document.createElement('p');
  name.className = 'rank-name';
  name.textContent = progress.current.label;

  const bar = document.createElement('div');
  bar.className = 'rank-bar';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  bar.setAttribute('aria-valuenow', String(Math.round(progress.ratio * 100)));

  const fill = document.createElement('div');
  fill.className = 'rank-bar-fill';
  fill.style.width = `${(progress.ratio * 100).toFixed(1)}%`;
  bar.appendChild(fill);

  const note = document.createElement('p');
  note.className = 'rank-note mono';
  if (progress.isMax) {
    // Deliberately not a full bar with no explanation -- say it is the ceiling.
    bar.dataset.max = 'true';
    note.textContent = '最高階級。これ以上堕ちるところはない。';
  } else {
    note.textContent = `次の「${progress.next?.label}」まであと${progress.remaining}基`;
  }

  el.append(heading, name, bar, note, buildLifetimeList(ledger));
}

/**
 * Lifetime figures that have no home in the four stat blocks. They exist in the
 * ledger regardless; surfacing them gives the idle loop more to accumulate than
 * a single rank label.
 */
function buildLifetimeList(ledger: LifetimeLedger): HTMLElement {
  const list = document.createElement('dl');
  list.className = 'rank-ledger';

  const rows: Array<[string, string]> = [
    ['最長生存', ledger.longestLifespanMs > 0 ? formatNeglect(ledger.longestLifespanMs) : '—'],
    ['同時最大', ledger.peakAlive > 0 ? `${ledger.peakAlive}本` : '—'],
    ['焼き払い', `${ledger.burnCount}回`],
  ];

  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'rank-ledger-row';

    const dt = document.createElement('dt');
    dt.textContent = label;

    const dd = document.createElement('dd');
    dd.textContent = value;

    row.append(dt, dd);
    list.appendChild(row);
  }

  return list;
}

/**
 * Achievement stamps. Locked ones stay visible with their requirement showing,
 * so there is always something concrete to aim at.
 */
export function renderAchievements(el: HTMLElement, ledger: LifetimeLedger): void {
  el.innerHTML = '';

  const unlocked = new Set(ledger.unlocked);

  const heading = document.createElement('p');
  heading.className = 'achievements-heading mono';
  heading.textContent = `実績 ${unlocked.size} / ${ACHIEVEMENTS.length}`;
  el.appendChild(heading);

  const list = document.createElement('ul');
  list.className = 'achievement-list';

  for (const a of ACHIEVEMENTS) {
    const isUnlocked = unlocked.has(a.id);

    const item = document.createElement('li');
    item.className = 'achievement';
    item.dataset.unlocked = String(isUnlocked);

    const label = document.createElement('p');
    label.className = 'achievement-label';
    label.textContent = a.label;

    const req = document.createElement('p');
    req.className = 'achievement-req';
    req.textContent = a.requirement;

    item.append(label, req);

    if (isUnlocked) {
      const mark = document.createElement('span');
      mark.className = 'achievement-mark mono';
      mark.textContent = '済';
      mark.setAttribute('aria-label', '解除済み');
      item.appendChild(mark);
    }

    list.appendChild(item);
  }

  el.appendChild(list);
}
