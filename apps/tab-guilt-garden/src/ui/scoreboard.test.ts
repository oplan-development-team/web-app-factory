import { beforeEach, describe, expect, test } from 'vitest';
import { ACHIEVEMENTS } from '../domain/achievements';
import { emptyLedger } from '../domain/ledger';
import type { LifetimeLedger } from '../domain/types';
import { renderAchievements, renderRank, renderStats } from './scoreboard';

function ledger(overrides: Partial<LifetimeLedger> = {}): LifetimeLedger {
  return { ...emptyLedger(), ...overrides };
}

let el: HTMLElement;
beforeEach(() => {
  el = document.createElement('div');
  document.body.appendChild(el);
});

describe('renderStats', () => {
  test('renders the four stat blocks', () => {
    renderStats(el, { ledger: ledger(), aliveCount: 0, graveyardCount: 0 });
    expect(el.querySelectorAll('.stat-block')).toHaveLength(4);
  });

  test('reads totals from the lifetime ledger, not the current garden (AC-400a)', () => {
    // Garden is empty after a burn, but the lifetime total must still show.
    renderStats(el, {
      ledger: ledger({ totalPlanted: 42 }),
      aliveCount: 0,
      graveyardCount: 0,
    });
    expect(el.querySelector('.stat-total .stat-value')?.textContent).toBe('42');
  });

  test('shows live counts for the current garden', () => {
    renderStats(el, { ledger: ledger(), aliveCount: 3, graveyardCount: 7 });
    expect(el.querySelector('.stat-alive .stat-value')?.textContent).toBe('3');
    expect(el.querySelector('.stat-grave .stat-value')?.textContent).toBe('7');
  });

  test('shows a dash rather than "0秒" before any record exists', () => {
    renderStats(el, { ledger: ledger(), aliveCount: 0, graveyardCount: 0 });
    expect(el.querySelector('.stat-record .stat-value')?.textContent).toBe('—');
  });

  test('shows the dramatized longest neglect once set', () => {
    renderStats(el, {
      ledger: ledger({ longestNeglectMs: 60_000 }),
      aliveCount: 0,
      graveyardCount: 0,
    });
    expect(el.querySelector('.stat-record .stat-value')?.textContent).toBe('1時間0分');
  });

  test('replaces content on re-render instead of appending', () => {
    const input = { ledger: ledger(), aliveCount: 0, graveyardCount: 0 };
    renderStats(el, input);
    renderStats(el, input);
    expect(el.querySelectorAll('.stat-block')).toHaveLength(4);
  });
});

describe('renderRank (FR-401)', () => {
  test('shows the current rank name', () => {
    renderRank(el, ledger({ totalBuried: 0 }));
    expect(el.querySelector('.rank-name')?.textContent).toBe('無垢');
  });

  test('promotes as burials accumulate', () => {
    renderRank(el, ledger({ totalBuried: 6 }));
    expect(el.querySelector('.rank-name')?.textContent).toBe('重罪人');
  });

  test('states how many more burials the next rank needs', () => {
    renderRank(el, ledger({ totalBuried: 2 }));
    expect(el.querySelector('.rank-note')?.textContent).toContain('常習犯');
    expect(el.querySelector('.rank-note')?.textContent).toContain('1基');
  });

  test('fills the bar proportionally', () => {
    renderRank(el, ledger({ totalBuried: 2 }));
    const fill = el.querySelector<HTMLElement>('.rank-bar-fill');
    // jsdom normalises "50.0%" to "50%", so compare the value not the text.
    expect(Number.parseFloat(fill?.style.width ?? '')).toBeCloseTo(50, 5);
  });

  test('an empty ledger leaves the bar at zero width', () => {
    renderRank(el, ledger({ totalBuried: 0 }));
    const fill = el.querySelector<HTMLElement>('.rank-bar-fill');
    expect(Number.parseFloat(fill?.style.width ?? '')).toBe(0);
  });

  test('exposes progress to assistive tech', () => {
    renderRank(el, ledger({ totalBuried: 2 }));
    const bar = el.querySelector('.rank-bar');
    expect(bar?.getAttribute('role')).toBe('progressbar');
    expect(bar?.getAttribute('aria-valuenow')).toBe('50');
  });

  test('says the ladder is topped out rather than pinning a silent full bar (AC-401a)', () => {
    renderRank(el, ledger({ totalBuried: 50 }));
    const bar = el.querySelector<HTMLElement>('.rank-bar');
    expect(bar?.dataset.max).toBe('true');
    expect(el.querySelector('.rank-note')?.textContent).toContain('最高階級');
    expect(el.querySelector('.rank-note')?.textContent).not.toContain('あと');
  });

  test('re-rendering does not stack duplicate bars', () => {
    renderRank(el, ledger({ totalBuried: 1 }));
    renderRank(el, ledger({ totalBuried: 2 }));
    expect(el.querySelectorAll('.rank-bar')).toHaveLength(1);
  });
});

describe('renderAchievements (FR-402)', () => {
  test('lists every achievement, locked or not (AC-402b)', () => {
    renderAchievements(el, ledger());
    expect(el.querySelectorAll('.achievement')).toHaveLength(ACHIEVEMENTS.length);
  });

  test('shows the requirement for locked achievements so they are discoverable', () => {
    renderAchievements(el, ledger());
    const first = el.querySelector('.achievement');
    expect(first?.getAttribute('data-unlocked')).toBe('false');
    expect(first?.querySelector('.achievement-req')?.textContent?.length).toBeGreaterThan(0);
  });

  test('marks unlocked achievements', () => {
    renderAchievements(el, ledger({ unlocked: ['arsonist'] }));
    const unlocked = el.querySelectorAll('.achievement[data-unlocked="true"]');
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0]?.querySelector('.achievement-label')?.textContent).toBe('放火魔');
    expect(unlocked[0]?.querySelector('.achievement-mark')).not.toBeNull();
  });

  test('shows an unlocked/total counter', () => {
    renderAchievements(el, ledger({ unlocked: ['arsonist', 'ghosted'] }));
    expect(el.querySelector('.achievements-heading')?.textContent).toBe(
      `実績 2 / ${ACHIEVEMENTS.length}`,
    );
  });

  test('ignores unknown ids left over from an older build', () => {
    renderAchievements(el, ledger({ unlocked: ['no-such-achievement'] }));
    expect(el.querySelectorAll('.achievement[data-unlocked="true"]')).toHaveLength(0);
    expect(el.querySelectorAll('.achievement')).toHaveLength(ACHIEVEMENTS.length);
  });

  test('re-rendering replaces rather than appends', () => {
    renderAchievements(el, ledger());
    renderAchievements(el, ledger({ unlocked: ['arsonist'] }));
    expect(el.querySelectorAll('.achievement')).toHaveLength(ACHIEVEMENTS.length);
  });
});
