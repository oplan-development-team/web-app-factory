import { beforeEach, describe, expect, test } from 'vitest';
import type { GraveyardEntry } from '../domain/types';
import { renderGraveyard } from './graveyard';

const T0 = 1_700_000_000_000;

function grave(id: string, overrides: Partial<GraveyardEntry> = {}): GraveyardEntry {
  return {
    id,
    name: '',
    note: '',
    species: 'tree',
    plantedAt: T0,
    diedAt: T0 + 1000,
    cause: 'closed',
    neglectMsAtDeath: 1000,
    lifespanMs: 1000,
    ...overrides,
  };
}

let grid: HTMLElement;
let empty: HTMLElement;

beforeEach(() => {
  grid = document.createElement('div');
  empty = document.createElement('p');
  document.body.append(grid, empty);
});

describe('empty state', () => {
  test('shows the empty message when nothing is buried', () => {
    renderGraveyard(grid, empty, [], T0);
    expect(empty.hidden).toBe(false);
    expect(grid.children).toHaveLength(0);
  });

  test('hides it once a tombstone exists', () => {
    renderGraveyard(grid, empty, [grave('a')], T0);
    expect(empty.hidden).toBe(true);
  });
});

describe('tombstones', () => {
  test('renders one per entry, newest first', () => {
    renderGraveyard(
      grid,
      empty,
      [grave('old', { diedAt: T0 }), grave('new', { diedAt: T0 + 10_000 })],
      T0 + 20_000,
    );
    const names = [...grid.querySelectorAll('.tombstone')].map((s) => s.getAttribute('data-cause'));
    expect(names).toHaveLength(2);
    // Newest first means the later death leads.
    const first = grid.querySelector('.tombstone-name')?.textContent;
    expect(first).toBe('無題の罪');
  });

  test('records the cause of death for CSS and for the reader', () => {
    renderGraveyard(grid, empty, [grave('a', { cause: 'ghost' })], T0 + 5000);
    const stone = grid.querySelector<HTMLElement>('.tombstone');
    expect(stone?.dataset.cause).toBe('ghost');
    expect(stone?.textContent).toContain('音信不通');
  });

  test('distinguishes a deliberately closed tab', () => {
    renderGraveyard(grid, empty, [grave('a', { cause: 'closed' })], T0 + 5000);
    expect(grid.querySelector('.tombstone')?.textContent).toContain('自主退場');
  });

  test('shows the epitaph when an excuse was left', () => {
    renderGraveyard(grid, empty, [grave('a', { note: '来週読む' })], T0 + 5000);
    expect(grid.querySelector('.tombstone-epitaph')?.textContent).toBe('「来週読む」');
  });

  test('falls back to a jab when no excuse was left', () => {
    renderGraveyard(grid, empty, [grave('a')], T0 + 5000);
    expect(grid.querySelector('.tombstone-epitaph')?.textContent).toBe(
      '(言い訳すら残さなかった)',
    );
  });

  test('shows all four stat rows including time since burial (FR-403)', () => {
    renderGraveyard(grid, empty, [grave('a')], T0 + 5000);
    const labels = [...grid.querySelectorAll('.tombstone-stat-row dt')].map((d) => d.textContent);
    expect(labels).toEqual(['死因', '生存期間', '末期の放置', '埋葬から']);
  });

  test('the time-since-burial row advances with the clock (FR-403)', () => {
    const read = () =>
      [...grid.querySelectorAll('.tombstone-stat-row')]
        .find((r) => r.querySelector('dt')?.textContent === '埋葬から')
        ?.querySelector('dd')?.textContent;

    renderGraveyard(grid, empty, [grave('a', { diedAt: T0 })], T0 + 1000);
    const first = read();
    renderGraveyard(grid, empty, [grave('a', { diedAt: T0 })], T0 + 60_000);
    expect(read()).not.toBe(first);
  });

  test('never shows a negative age if the clock slips (E-10)', () => {
    renderGraveyard(grid, empty, [grave('a', { diedAt: T0 + 10_000 })], T0);
    expect(grid.querySelector('.tombstone')?.textContent).not.toContain('-');
  });

  test('replaces previous content rather than appending on each tick', () => {
    renderGraveyard(grid, empty, [grave('a')], T0);
    renderGraveyard(grid, empty, [grave('a')], T0 + 1000);
    expect(grid.querySelectorAll('.tombstone')).toHaveLength(1);
  });

  test('renders the species artwork', () => {
    renderGraveyard(grid, empty, [grave('a', { species: 'mushroom' })], T0);
    expect(grid.querySelector('.tombstone-icon svg')).not.toBeNull();
  });

  test('handles a long name and excuse without dropping them (E-11)', () => {
    const longName = 'あ'.repeat(40);
    const longNote = 'い'.repeat(80);
    renderGraveyard(grid, empty, [grave('a', { name: longName, note: longNote })], T0);
    expect(grid.querySelector('.tombstone-name')?.textContent).toBe(longName);
    expect(grid.querySelector('.tombstone-epitaph')?.textContent).toContain(longNote);
  });
});
