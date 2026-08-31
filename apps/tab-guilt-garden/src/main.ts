import './style.css';
import { GardenChannel } from './infra/channel';
import {
  GHOST_TIMEOUT_MS,
  HEARTBEAT_BROADCAST_MS,
  TICK_MS,
} from './domain/constants';
import { confirmModal } from './ui/modal';
import { computeSinRank, GardenRenderer, renderGraveyard, renderStats } from './render';
import { pickRandomSpecies } from './domain/species';
import { clearAll, loadGraveyard, loadPlants, saveGraveyard, savePlants } from './infra/storage';
import type { GraveyardEntry, PlantRecord } from './domain/types';

const selfId = crypto.randomUUID();
let closed = false;
let lastHeartbeatBroadcast = 0;

function createFreshRecord(now: number): PlantRecord {
  return {
    id: selfId,
    name: '',
    note: '',
    species: pickRandomSpecies(),
    plantedAt: now,
    lastFocusAt: now,
    lastHeartbeatAt: now,
  };
}

function upsertSelf(plants: PlantRecord[], record: PlantRecord): PlantRecord[] {
  const rest = plants.filter((p) => p.id !== record.id);
  return [...rest, record];
}

// --- DOM references ----------------------------------------------------
const statsEl = requireEl('stats-strip');
const gardenGridEl = requireEl('garden-grid');
const gardenEmptyEl = requireEl('garden-empty');
const graveyardGridEl = requireEl('graveyard-grid');
const graveyardEmptyEl = requireEl('graveyard-empty');
const tabCountLineEl = requireEl('tab-count-line');
const addTabLinkEl = requireEl('add-tab-link') as HTMLAnchorElement;
const resetBtnEl = requireEl('reset-btn') as HTMLButtonElement;

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

addTabLinkEl.href = window.location.href;

const gardenRenderer = new GardenRenderer(gardenGridEl, gardenEmptyEl);
const channel = new GardenChannel();

// --- initial plant ------------------------------------------------------
{
  const now = Date.now();
  const initialPlants = upsertSelf(loadPlants(), createFreshRecord(now));
  savePlants(initialPlants);
  channel.post({ type: 'planted', id: selfId });
}

function isFocusedNow(): boolean {
  return document.hasFocus() && document.visibilityState === 'visible';
}

function tick(): void {
  const now = Date.now();
  let plants = loadPlants();
  const graveyard = loadGraveyard();
  // Cross-tab writes are last-write-wins on localStorage: a slow tick in one
  // tab can race a close/removal in another and briefly resurrect a record.
  // Self-heal by never showing a plant whose id already has a grave.
  const buriedIds = new Set(graveyard.map((g) => g.id));
  plants = plants.filter((p) => !buriedIds.has(p.id));

  const self = plants.find((p) => p.id === selfId);
  const focused = isFocusedNow();
  const updatedSelf: PlantRecord = self
    ? { ...self, lastHeartbeatAt: now, lastFocusAt: focused ? now : self.lastFocusAt }
    : { ...createFreshRecord(now), lastFocusAt: focused ? now : now };
  plants = upsertSelf(plants, updatedSelf);

  // ghost sweep: anyone else whose heartbeat has gone silent too long is presumed crashed.
  const survivors: PlantRecord[] = [];
  const ghostIds: string[] = [];
  for (const p of plants) {
    if (p.id === selfId) {
      survivors.push(p);
      continue;
    }
    if (now - p.lastHeartbeatAt > GHOST_TIMEOUT_MS) {
      graveyard.push(toGraveyardEntry(p, now, 'ghost'));
      ghostIds.push(p.id);
    } else {
      survivors.push(p);
    }
  }

  savePlants(survivors);
  if (ghostIds.length > 0) {
    saveGraveyard(graveyard);
    // The message must carry the id of the plant that was buried, not our own.
    for (const ghostId of ghostIds) channel.post({ type: 'buried', id: ghostId });
  }

  if (now - lastHeartbeatBroadcast > HEARTBEAT_BROADCAST_MS) {
    lastHeartbeatBroadcast = now;
    channel.post({ type: 'heartbeat', id: selfId });
  }

  render(survivors, now);
}

function toGraveyardEntry(
  p: PlantRecord,
  now: number,
  cause: GraveyardEntry['cause'],
): GraveyardEntry {
  return {
    id: p.id,
    name: p.name,
    note: p.note,
    species: p.species,
    plantedAt: p.plantedAt,
    diedAt: now,
    cause,
    neglectMsAtDeath: Math.max(0, now - p.lastFocusAt),
    lifespanMs: Math.max(0, now - p.plantedAt),
  };
}

function render(plants: PlantRecord[], now: number): void {
  const graveyard = loadGraveyard();

  tabCountLineEl.textContent = `放置タブ${plants.length}本、墓標${graveyard.length}基 -- ${computeSinRank(
    graveyard.length,
  )}`;

  const liveNeglects = plants.map((p) => now - p.lastFocusAt);
  const deadNeglects = graveyard.map((g) => g.neglectMsAtDeath);
  const allNeglects = [...liveNeglects, ...deadNeglects];
  const longestNeglectMs = allNeglects.length ? Math.max(...allNeglects) : null;

  renderStats(statsEl, {
    totalPlanted: plants.length + graveyard.length,
    aliveCount: plants.length,
    graveyardCount: graveyard.length,
    longestNeglectMs,
  });

  gardenRenderer.update(plants, now, selfId, {
    onNameChange: (id, value) => patchSelfField(id, { name: value }),
    onNoteChange: (id, value) => patchSelfField(id, { note: value }),
  });

  renderGraveyard(graveyardGridEl, graveyardEmptyEl, graveyard);
}

function patchSelfField(id: string, patch: Partial<Pick<PlantRecord, 'name' | 'note'>>): void {
  if (id !== selfId) return;
  const plants = loadPlants();
  const self = plants.find((p) => p.id === selfId);
  if (!self) return;
  savePlants(upsertSelf(plants, { ...self, ...patch }));
}

function handleOwnClose(): void {
  if (closed) return;
  closed = true;
  const now = Date.now();
  const plants = loadPlants();
  const self = plants.find((p) => p.id === selfId);
  const remaining = plants.filter((p) => p.id !== selfId);
  savePlants(remaining);
  if (self) {
    const graveyard = loadGraveyard();
    graveyard.push(toGraveyardEntry(self, now, 'closed'));
    saveGraveyard(graveyard);
  }
  channel.post({ type: 'buried', id: selfId });
}

async function handleReset(): Promise<void> {
  const confirmed = await confirmModal({
    title: '本当に庭を焼き払いますか？',
    body: '生存中の苗も墓標も、この端末のこのブラウザから全部消えます。今開いている他のタブは、次の瞬間にまた新しい罪として芽吹き直します。',
    confirmLabel: '焼き払う',
    cancelLabel: 'やめておく',
  });
  if (!confirmed) return;

  clearAll();
  const now = Date.now();
  const fresh = createFreshRecord(now);
  savePlants([fresh]);
  saveGraveyard([]);
  channel.post({ type: 'reset' });
  tick();
}

resetBtnEl.addEventListener('click', () => {
  handleReset().catch(() => {
    /* modal cannot throw in practice; guard kept for safety */
  });
});

window.addEventListener('focus', tick);
window.addEventListener('blur', tick);
document.addEventListener('visibilitychange', tick);
window.addEventListener('pagehide', handleOwnClose);
window.addEventListener('beforeunload', handleOwnClose);

channel.onMessage((msg) => {
  if (msg.type === 'reset') {
    // another tab reset the garden; replant ourselves fresh into the (now-empty) storage.
    const now = Date.now();
    const fresh = createFreshRecord(now);
    savePlants(upsertSelf(loadPlants(), fresh));
  }
  tick();
});

setInterval(tick, TICK_MS);
tick();
