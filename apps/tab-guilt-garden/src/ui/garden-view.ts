import { EXCUSE_PLACEHOLDER, NAME_PLACEHOLDER } from '../domain/constants';
import { formatNeglect } from '../domain/format';
import {
  computeDroopDeg,
  computeScale,
  describePlant,
  STAGE_LABEL,
  STAGE_TAUNT,
} from '../domain/health';
import { speciesSvg } from '../domain/species';
import type { PlantRecord } from '../domain/types';

export interface GardenHandlers {
  onNameChange(id: string, value: string): void;
  onNoteChange(id: string, value: string): void;
}

interface CardRefs {
  root: HTMLElement;
  icon: HTMLElement;
  stageBadge: HTMLElement;
  taunt: HTMLElement;
  neglectValue: HTMLElement;
  nameEl: HTMLElement | HTMLInputElement;
  noteEl: HTMLElement | HTMLInputElement;
}

/**
 * Renders the living garden. Cards are created once per plant and then patched
 * in place every tick, rather than re-rendered -- otherwise the input the user
 * is typing into would be destroyed and recreated once a second.
 */
export class GardenRenderer {
  private cardRefs = new Map<string, CardRefs>();

  constructor(
    private gardenEl: HTMLElement,
    private emptyGardenEl: HTMLElement,
  ) {}

  /** `plants` is expected pre-ordered by the engine (self first, then oldest). */
  update(plants: PlantRecord[], now: number, selfId: string, handlers: GardenHandlers): void {
    const seen = new Set<string>();

    this.emptyGardenEl.hidden = plants.length > 0;

    plants.forEach((plant) => {
      seen.add(plant.id);
      let refs = this.cardRefs.get(plant.id);
      if (!refs) {
        refs = this.buildCard(plant, plant.id === selfId, handlers);
        this.cardRefs.set(plant.id, refs);
        this.gardenEl.appendChild(refs.root);
      }
      this.patchCard(refs, plant, now);
    });

    for (const [id, refs] of this.cardRefs) {
      if (!seen.has(id)) {
        refs.root.remove();
        this.cardRefs.delete(id);
      }
    }
  }

  private buildCard(plant: PlantRecord, isSelf: boolean, handlers: GardenHandlers): CardRefs {
    const root = document.createElement('article');
    root.className = 'plant-card stage-tint';
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
      const nameInput = document.createElement('input');
      nameInput.className = 'plant-name-input';
      nameInput.maxLength = 40;
      nameInput.placeholder = NAME_PLACEHOLDER;
      nameInput.value = plant.name;
      nameInput.setAttribute('aria-label', 'このタブの名前');
      nameInput.addEventListener('input', () => {
        handlers.onNameChange(plant.id, nameInput.value);
      });
      nameEl = nameInput;

      const noteInput = document.createElement('input');
      noteInput.className = 'plant-note-input';
      noteInput.maxLength = 80;
      noteInput.placeholder = EXCUSE_PLACEHOLDER;
      noteInput.value = plant.note;
      noteInput.setAttribute('aria-label', 'このタブを閉じない言い訳');
      noteInput.addEventListener('input', () => {
        handlers.onNoteChange(plant.id, noteInput.value);
      });
      noteEl = noteInput;
    } else {
      nameEl = document.createElement('p');
      nameEl.className = 'plant-name';
      noteEl = document.createElement('p');
      noteEl.className = 'plant-note';
    }

    const taunt = document.createElement('p');
    taunt.className = 'plant-taunt';

    body.append(nameEl, noteEl, taunt);

    const foot = document.createElement('div');
    foot.className = 'plant-card-foot';
    const neglectLabel = document.createElement('span');
    neglectLabel.className = 'neglect-label';
    neglectLabel.textContent = '放置';
    const neglectValue = document.createElement('span');
    neglectValue.className = 'neglect-value';
    foot.append(neglectLabel, neglectValue);

    root.append(top, body, foot);

    return { root, icon, stageBadge, taunt, neglectValue, nameEl, noteEl };
  }

  private patchCard(refs: CardRefs, plant: PlantRecord, now: number): void {
    const { maturity, vitality, neglectMs, stage } = describePlant(plant, now);
    const droop = computeDroopDeg(vitality);
    const scale = computeScale(vitality, maturity);

    refs.root.dataset.stage = stage;
    refs.icon.style.transform = `rotate(${droop}deg) scale(${scale.toFixed(3)})`;
    refs.stageBadge.textContent = STAGE_LABEL[stage];
    refs.taunt.textContent = STAGE_TAUNT[stage];

    refs.neglectValue.textContent = neglectMs < 1000 ? 'いまここ' : formatNeglect(neglectMs);

    // Writing to a focused input would move the caret, so only sync when it
    // actually differs (i.e. the value came from another tab).
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
