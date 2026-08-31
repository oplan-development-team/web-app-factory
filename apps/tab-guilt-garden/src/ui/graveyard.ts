import { NAME_PLACEHOLDER } from '../domain/constants';
import { formatNeglect } from '../domain/format';
import { speciesSvg } from '../domain/species';
import type { GraveyardEntry } from '../domain/types';

const CAUSE_LABEL: Record<GraveyardEntry['cause'], string> = {
  closed: '自主退場(閉じられた)',
  ghost: '音信不通(強制終了)',
};

/**
 * Renders the memorial for closed tabs. The "埋葬から" row keeps counting up on
 * every tick, so the page still visibly advances even when the garden itself is
 * empty -- the idle clock never stops.
 */
export function renderGraveyard(
  el: HTMLElement,
  emptyEl: HTMLElement,
  entries: GraveyardEntry[],
  now: number,
): void {
  emptyEl.hidden = entries.length > 0;
  el.innerHTML = '';

  const ordered = [...entries].sort((a, b) => b.diedAt - a.diedAt);

  for (const entry of ordered) {
    el.appendChild(buildTombstone(entry, now));
  }
}

function buildTombstone(entry: GraveyardEntry, now: number): HTMLElement {
  const stone = document.createElement('div');
  stone.className = 'tombstone';
  stone.dataset.cause = entry.cause;

  const icon = document.createElement('div');
  icon.className = 'tombstone-icon';
  icon.innerHTML = speciesSvg(entry.species);

  const name = document.createElement('p');
  name.className = 'tombstone-name';
  name.textContent = entry.name || NAME_PLACEHOLDER;

  const epitaph = document.createElement('p');
  epitaph.className = 'tombstone-epitaph';
  epitaph.textContent = entry.note ? `「${entry.note}」` : '(言い訳すら残さなかった)';

  const stats = document.createElement('dl');
  stats.className = 'tombstone-stats';
  stats.append(
    statRow('死因', CAUSE_LABEL[entry.cause]),
    statRow('生存期間', formatNeglect(entry.lifespanMs)),
    statRow('末期の放置', formatNeglect(entry.neglectMsAtDeath)),
    statRow('埋葬から', formatNeglect(Math.max(0, now - entry.diedAt))),
  );

  stone.append(icon, name, epitaph, stats);
  return stone;
}

function statRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'tombstone-stat-row';
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  row.append(dt, dd);
  return row;
}
