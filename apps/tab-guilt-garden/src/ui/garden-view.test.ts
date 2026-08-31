import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DECAY_MS, FOSSIL_AT_MS, GROWTH_MS, HUSK_AT_MS } from '../domain/constants';
import type { PlantRecord } from '../domain/types';
import { GardenRenderer, type GardenHandlers } from './garden-view';

const T0 = 1_700_000_000_000;

function plant(id: string, overrides: Partial<PlantRecord> = {}): PlantRecord {
  return {
    id,
    name: '',
    note: '',
    species: 'flower',
    plantedAt: T0,
    lastFocusAt: T0,
    lastHeartbeatAt: T0,
    ...overrides,
  };
}

function setup() {
  const grid = document.createElement('div');
  const empty = document.createElement('p');
  document.body.append(grid, empty);
  const handlers: GardenHandlers = {
    onNameChange: vi.fn(),
    onNoteChange: vi.fn(),
  };
  return { grid, empty, handlers, renderer: new GardenRenderer(grid, empty) };
}

let ctx: ReturnType<typeof setup>;
beforeEach(() => {
  ctx = setup();
});

describe('empty state (FR-502)', () => {
  test('shows the empty message when there are no plants', () => {
    ctx.renderer.update([], T0, 'me', ctx.handlers);
    expect(ctx.empty.hidden).toBe(false);
    expect(ctx.grid.children).toHaveLength(0);
  });

  test('hides it as soon as a plant exists', () => {
    ctx.renderer.update([plant('me')], T0, 'me', ctx.handlers);
    expect(ctx.empty.hidden).toBe(true);
  });
});

describe('card construction', () => {
  test('renders one card per plant', () => {
    ctx.renderer.update([plant('me'), plant('b')], T0, 'me', ctx.handlers);
    expect(ctx.grid.querySelectorAll('.plant-card')).toHaveLength(2);
  });

  test('marks the caller card with a YOU badge and editable inputs', () => {
    ctx.renderer.update([plant('me')], T0, 'me', ctx.handlers);
    const card = ctx.grid.querySelector('.plant-card');
    expect(card?.querySelector('.you-badge')?.textContent).toBe('YOU');
    expect(card?.querySelector('input.plant-name-input')).not.toBeNull();
    expect(card?.querySelector('input.plant-note-input')).not.toBeNull();
  });

  test('other tabs are read-only text, not inputs', () => {
    ctx.renderer.update([plant('other')], T0, 'me', ctx.handlers);
    const card = ctx.grid.querySelector('.plant-card');
    expect(card?.querySelector('.you-badge')).toBeNull();
    expect(card?.querySelector('input')).toBeNull();
    expect(card?.querySelector('p.plant-name')).not.toBeNull();
  });

  test('caps the editable fields at the documented lengths (E-11)', () => {
    ctx.renderer.update([plant('me')], T0, 'me', ctx.handlers);
    const name = ctx.grid.querySelector<HTMLInputElement>('.plant-name-input');
    const note = ctx.grid.querySelector<HTMLInputElement>('.plant-note-input');
    expect(name?.maxLength).toBe(40);
    expect(note?.maxLength).toBe(80);
  });

  test('labels the inputs for assistive tech (FR-602)', () => {
    ctx.renderer.update([plant('me')], T0, 'me', ctx.handlers);
    expect(
      ctx.grid.querySelector('.plant-name-input')?.getAttribute('aria-label'),
    ).toBeTruthy();
    expect(
      ctx.grid.querySelector('.plant-note-input')?.getAttribute('aria-label'),
    ).toBeTruthy();
  });

  test('records the species for CSS hooks', () => {
    ctx.renderer.update([plant('me', { species: 'cactus' })], T0, 'me', ctx.handlers);
    expect(ctx.grid.querySelector<HTMLElement>('.plant-card')?.dataset.species).toBe('cactus');
  });
});

describe('editing', () => {
  test('typing in the name field notifies the handler', () => {
    ctx.renderer.update([plant('me')], T0, 'me', ctx.handlers);
    const input = ctx.grid.querySelector<HTMLInputElement>('.plant-name-input')!;
    input.value = 'あとで読む';
    input.dispatchEvent(new Event('input'));
    expect(ctx.handlers.onNameChange).toHaveBeenCalledWith('me', 'あとで読む');
  });

  test('typing in the excuse field notifies the handler', () => {
    ctx.renderer.update([plant('me')], T0, 'me', ctx.handlers);
    const input = ctx.grid.querySelector<HTMLInputElement>('.plant-note-input')!;
    input.value = '本当に読む';
    input.dispatchEvent(new Event('input'));
    expect(ctx.handlers.onNoteChange).toHaveBeenCalledWith('me', '本当に読む');
  });

  test('re-rendering does not clobber what the user is typing', () => {
    ctx.renderer.update([plant('me')], T0, 'me', ctx.handlers);
    const input = ctx.grid.querySelector<HTMLInputElement>('.plant-name-input')!;
    input.value = '入力中';
    // A tick arrives while the store still has the old (empty) name.
    ctx.renderer.update([plant('me', { name: '入力中' })], T0 + 1000, 'me', ctx.handlers);
    expect(input.value).toBe('入力中');
  });

  test('reuses the same DOM node across ticks instead of rebuilding', () => {
    ctx.renderer.update([plant('me')], T0, 'me', ctx.handlers);
    const first = ctx.grid.querySelector('.plant-card');
    ctx.renderer.update([plant('me')], T0 + 1000, 'me', ctx.handlers);
    expect(ctx.grid.querySelector('.plant-card')).toBe(first);
  });
});

describe('stage rendering', () => {
  const stageAt = (elapsed: number, focusedAt = T0) => {
    ctx.renderer.update([plant('me', { lastFocusAt: focusedAt })], T0 + elapsed, 'me', ctx.handlers);
    return ctx.grid.querySelector<HTMLElement>('.plant-card')?.dataset.stage;
  };

  test('walks through the whole decay ladder as time passes (AC-103a)', () => {
    expect(stageAt(0)).toBe('sprout');
    expect(stageAt(GROWTH_MS)).toBe('bloom');
    expect(stageAt(DECAY_MS * 0.6)).toBe('wilt');
    expect(stageAt(DECAY_MS)).toBe('dead');
    expect(stageAt(HUSK_AT_MS + 1)).toBe('husk');
    expect(stageAt(FOSSIL_AT_MS + 1)).toBe('fossil');
  });

  test('shows a stage label and a taunt for every stage', () => {
    ctx.renderer.update([plant('me')], T0 + FOSSIL_AT_MS + 1, 'me', ctx.handlers);
    const card = ctx.grid.querySelector('.plant-card');
    expect(card?.querySelector('.stage-badge')?.textContent).toBe('化石化');
    expect(card?.querySelector('.plant-taunt')?.textContent?.length).toBeGreaterThan(0);
  });

  test('droops and shrinks the plant as it decays', () => {
    ctx.renderer.update([plant('me')], T0, 'me', ctx.handlers);
    const icon = ctx.grid.querySelector<HTMLElement>('.plant-species-icon')!;
    const healthy = icon.style.transform;
    ctx.renderer.update([plant('me')], T0 + DECAY_MS, 'me', ctx.handlers);
    expect(icon.style.transform).not.toBe(healthy);
    expect(icon.style.transform).toMatch(/rotate\(-\d/);
  });

  test('shows a friendly marker instead of "0秒" for a just-focused plant', () => {
    ctx.renderer.update([plant('me')], T0, 'me', ctx.handlers);
    expect(ctx.grid.querySelector('.neglect-value')?.textContent).toBe('いまここ');
  });

  test('shows dramatized neglect once time has passed', () => {
    ctx.renderer.update([plant('me')], T0 + 60_000, 'me', ctx.handlers);
    // 60 real seconds x60 == 1 story hour.
    expect(ctx.grid.querySelector('.neglect-value')?.textContent).toBe('1時間0分');
  });
});

describe('placeholder text', () => {
  test('an unnamed peer plant falls back to the placeholder', () => {
    ctx.renderer.update([plant('other')], T0, 'me', ctx.handlers);
    expect(ctx.grid.querySelector('.plant-name')?.textContent).toBe('無題の罪');
    expect(ctx.grid.querySelector('.plant-note')?.textContent).toBe('言い訳を入力...');
  });

  test('a named peer plant shows its real values', () => {
    ctx.renderer.update(
      [plant('other', { name: '確定申告', note: '来週やる' })],
      T0,
      'me',
      ctx.handlers,
    );
    expect(ctx.grid.querySelector('.plant-name')?.textContent).toBe('確定申告');
    expect(ctx.grid.querySelector('.plant-note')?.textContent).toBe('来週やる');
  });
});

describe('card lifecycle', () => {
  test('removes the card when a plant disappears', () => {
    ctx.renderer.update([plant('me'), plant('gone')], T0, 'me', ctx.handlers);
    expect(ctx.grid.querySelectorAll('.plant-card')).toHaveLength(2);

    ctx.renderer.update([plant('me')], T0 + 1000, 'me', ctx.handlers);
    expect(ctx.grid.querySelectorAll('.plant-card')).toHaveLength(1);
  });

  test('renders in the order given by the engine', () => {
    ctx.renderer.update([plant('me'), plant('a'), plant('b')], T0, 'me', ctx.handlers);
    const ids = [...ctx.grid.querySelectorAll('.plant-card')].map(
      (c) => c.querySelector('.you-badge') !== null,
    );
    expect(ids[0]).toBe(true);
  });
});
