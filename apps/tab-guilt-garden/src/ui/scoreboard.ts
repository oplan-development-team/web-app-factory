import { formatNeglect } from '../domain/format';
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
