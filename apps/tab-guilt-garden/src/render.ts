import { EXCUSE_PLACEHOLDER, NAME_PLACEHOLDER } from './domain/constants';
import { formatNeglect } from './domain/format';
import {
  computeDroopDeg,
  computeMaturity,
  computeNeglectMs,
  computeScale,
  computeStage,
  computeVitality,
  STAGE_LABEL,
} from './domain/health';
import { speciesSvg } from './domain/species';
import type { GraveyardEntry, PlantRecord } from './domain/types';

export interface GardenHandlers {
  onNameChange(id: string, value: string): void;
  onNoteChange(id: string, value: string): void;
}

interface CardRefs {
  root: HTMLElement;
  icon: HTMLElement;
  stageBadge: HTMLElement;
  neglectValue: HTMLElement;
  nameEl: HTMLElement | HTMLInputElement;
  noteEl: HTMLElement | HTMLInputElement;
}

const CAUSE_LABEL: Record<GraveyardEntry['cause'], string> = {
  closed: '自主退場(閉じられた)',
  ghost: '音信不通(強制終了)',
};

export class GardenRenderer {
  private cardRefs = new Map<string, CardRefs>();

  constructor(
    private gardenEl: HTMLElement,
    private emptyGardenEl: HTMLElement,
  ) {}

  update(plants: PlantRecord[], now: number, selfId: string, handlers: GardenHandlers): void {
    const seen = new Set<string>();

    // stable-ish order: self first, then by plantedAt ascending
    const ordered = [...plants].sort((a, b) => {
      if (a.id === selfId) return -1;
      if (b.id === selfId) return 1;
      return a.plantedAt - b.plantedAt;
    });

    this.emptyGardenEl.hidden = ordered.length > 0;

    ordered.forEach((plant) => {
      seen.add(plant.id);
      let refs = this.cardRefs.get(plant.id);
      if (!refs) {
        refs = this.buildCard(plant, plant.id === selfId, handlers);
        this.cardRefs.set(plant.id, refs);
        this.gardenEl.appendChild(refs.root);
      }
      this.patchCard(refs, plant, now);
    });

    // remove cards for plants no longer present
    for (const [id, refs] of this.cardRefs) {
      if (!seen.has(id)) {
        refs.root.remove();
        this.cardRefs.delete(id);
      }
    }
  }

  private buildCard(plant: PlantRecord, isSelf: boolean, handlers: GardenHandlers): CardRefs {
    const root = document.createElement('article');
    root.className = 'plant-card';
    root.dataset.species = plant.species;

    if (isSelf) {
      const badge = document.createElement('span');
      badge.className = 'you-badge';
      badge.textContent = 'YOU';
      root.appendChild(badge);
    }

    const top = document.createElement('div');
    top.className = 'plant-card-top';

    const icon = document.createElement('div');
    icon.className = 'plant-species-icon';
    icon.innerHTML = speciesSvg(plant.species);

    const stageBadge = document.createElement('span');
    stageBadge.className = 'stage-badge';

    top.append(icon, stageBadge);

    const body = document.createElement('div');
    body.className = 'plant-card-body';

    let nameEl: HTMLElement | HTMLInputElement;
    let noteEl: HTMLElement | HTMLInputElement;

    if (isSelf) {
      nameEl = document.createElement('input');
      nameEl.className = 'plant-name-input';
      (nameEl as HTMLInputElement).maxLength = 40;
      (nameEl as HTMLInputElement).placeholder = NAME_PLACEHOLDER;
      (nameEl as HTMLInputElement).value = plant.name;
      nameEl.addEventListener('input', () => {
        handlers.onNameChange(plant.id, (nameEl as HTMLInputElement).value);
      });

      noteEl = document.createElement('input');
      noteEl.className = 'plant-note-input';
      (noteEl as HTMLInputElement).maxLength = 80;
      (noteEl as HTMLInputElement).placeholder = EXCUSE_PLACEHOLDER;
      (noteEl as HTMLInputElement).value = plant.note;
      noteEl.addEventListener('input', () => {
        handlers.onNoteChange(plant.id, (noteEl as HTMLInputElement).value);
      });
    } else {
      nameEl = document.createElement('p');
      nameEl.className = 'plant-name';
      noteEl = document.createElement('p');
      noteEl.className = 'plant-note';
    }

    body.append(nameEl, noteEl);

    const foot = document.createElement('div');
    foot.className = 'plant-card-foot';
    const neglectLabel = document.createElement('span');
    neglectLabel.className = 'neglect-label';
    neglectLabel.textContent = '放置';
    const neglectValue = document.createElement('span');
    neglectValue.className = 'neglect-value';
    foot.append(neglectLabel, neglectValue);

    root.append(top, body, foot);

    return { root, icon, stageBadge, neglectValue, nameEl, noteEl };
  }

  private patchCard(refs: CardRefs, plant: PlantRecord, now: number): void {
    const maturity = computeMaturity(plant, now);
    const vitality = computeVitality(plant, now);
    const neglectMs = computeNeglectMs(plant, now);
    const stage = computeStage(maturity, vitality, neglectMs);
    const droop = computeDroopDeg(vitality);
    const scale = computeScale(vitality, maturity);

    refs.root.dataset.stage = stage;
    refs.icon.style.transform = `rotate(${droop}deg) scale(${scale.toFixed(3)})`;
    refs.stageBadge.textContent = STAGE_LABEL[stage];

    refs.neglectValue.textContent = neglectMs < 1000 ? 'いまここ' : formatNeglect(neglectMs);

    if (refs.nameEl instanceof HTMLInputElement) {
      if (refs.nameEl.value !== plant.name) refs.nameEl.value = plant.name;
    } else if (refs.nameEl.textContent !== (plant.name || NAME_PLACEHOLDER)) {
      refs.nameEl.textContent = plant.name || NAME_PLACEHOLDER;
    }

    if (refs.noteEl instanceof HTMLInputElement) {
      if (refs.noteEl.value !== plant.note) refs.noteEl.value = plant.note;
    } else {
      const noteText = plant.note || EXCUSE_PLACEHOLDER;
      if (refs.noteEl.textContent !== noteText) refs.noteEl.textContent = noteText;
    }
  }
}

export function renderGraveyard(
  el: HTMLElement,
  emptyEl: HTMLElement,
  entries: GraveyardEntry[],
): void {
  emptyEl.hidden = entries.length > 0;
  el.innerHTML = '';

  const ordered = [...entries].sort((a, b) => b.diedAt - a.diedAt);

  for (const entry of ordered) {
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
    );

    stone.append(icon, name, epitaph, stats);
    el.appendChild(stone);
  }
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

export interface SinScoreInput {
  totalPlanted: number;
  aliveCount: number;
  graveyardCount: number;
  longestNeglectMs: number | null;
}

export function computeSinRank(graveyardCount: number): string {
  if (graveyardCount === 0) return '無垢';
  if (graveyardCount <= 2) return '軽犯罪';
  if (graveyardCount <= 5) return '常習犯';
  if (graveyardCount <= 10) return '重罪人';
  return '庭の破壊神';
}

export function renderStats(el: HTMLElement, data: SinScoreInput): void {
  el.innerHTML = '';

  const blocks: Array<{ cls: string; label: string; value: string; sub?: string }> = [
    {
      cls: 'stat-total',
      label: '総植栽数',
      value: String(data.totalPlanted),
      sub: 'これまで芽吹いた罪',
    },
    { cls: 'stat-alive', label: '現在生存', value: String(data.aliveCount) },
    { cls: 'stat-grave', label: '墓標', value: String(data.graveyardCount) },
    {
      cls: 'stat-record',
      label: '最長放置記録',
      value: data.longestNeglectMs != null ? formatNeglect(data.longestNeglectMs) : '-',
    },
  ];

  for (const b of blocks) {
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
    el.appendChild(card);
  }
}
