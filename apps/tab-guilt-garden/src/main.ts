import './style.css';
import { TICK_MS } from './domain/constants';
import { GardenEngine } from './engine';
import { GardenChannel } from './infra/channel';
import { GardenStore } from './infra/storage';
import { confirmModal } from './ui/modal';
import { GardenRenderer } from './ui/garden-view';
import { renderGraveyard } from './ui/graveyard';
import { renderAchievements, renderRank, renderStats } from './ui/scoreboard';
import { hideIntro, isIntroVisible, renderIntro } from './ui/intro';

/**
 * Wiring only. Every decision lives in GardenEngine (simulation) or the ui/
 * modules (presentation); this file just connects the real clock, storage,
 * BroadcastChannel and DOM to them.
 */

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

const statsEl = requireEl('stats-strip');
const gardenGridEl = requireEl('garden-grid');
const gardenEmptyEl = requireEl('garden-empty');
const graveyardGridEl = requireEl('graveyard-grid');
const graveyardEmptyEl = requireEl('graveyard-empty');
const tabCountLineEl = requireEl('tab-count-line');
const addTabLinkEl = requireEl('add-tab-link') as HTMLAnchorElement;
const resetBtnEl = requireEl('reset-btn') as HTMLButtonElement;
const rankPanelEl = requireEl('rank-panel');
const achievementsPanelEl = requireEl('achievements-panel');
const introPanelEl = requireEl('intro-panel');
const helpBtnEl = requireEl('help-btn') as HTMLButtonElement;

addTabLinkEl.href = window.location.href;

const store = new GardenStore();
const channel = new GardenChannel();
const engine = new GardenEngine({
  store,
  channel,
  selfId: crypto.randomUUID(),
  now: () => Date.now(),
  isFocused: () => document.hasFocus() && document.visibilityState === 'visible',
});

const gardenRenderer = new GardenRenderer(gardenGridEl, gardenEmptyEl);

function tick(): void {
  const snapshot = engine.tick();

  tabCountLineEl.textContent = `放置タブ${snapshot.aliveCount}本、墓標${snapshot.graveyard.length}基`;

  renderStats(statsEl, {
    ledger: snapshot.ledger,
    aliveCount: snapshot.aliveCount,
    graveyardCount: snapshot.graveyard.length,
  });

  renderRank(rankPanelEl, snapshot.ledger);
  renderAchievements(achievementsPanelEl, snapshot.ledger);

  gardenRenderer.update(snapshot.plants, snapshot.now, snapshot.selfId, {
    onNameChange: (id, value) => engine.patchOwn(id, { name: value }),
    onNoteChange: (id, value) => engine.patchOwn(id, { note: value }),
  });

  renderGraveyard(graveyardGridEl, graveyardEmptyEl, snapshot.graveyard, snapshot.now);
}

async function handleReset(): Promise<void> {
  const { confirmed, toggled } = await confirmModal({
    title: '本当に庭を焼き払いますか？',
    body: '生存中の苗も墓標も、この端末のこのブラウザから全部消えます。今開いている他のタブは、次の瞬間にまた新しい罪として芽吹き直します。',
    confirmLabel: '焼き払う',
    cancelLabel: 'やめておく',
    toggleLabel: '通算記録と実績も消す',
    toggleHint: '通常の焼き払いでは、これまでの通算記録と解除済みの実績は残ります。',
  });
  if (!confirmed) return;

  engine.reset(toggled);
  tick();
}

function showIntro(): void {
  renderIntro(introPanelEl, { onDismiss: () => store.markIntroSeen() });
}

// Shown unprompted only on the very first visit; afterwards it is on demand.
if (!store.hasSeenIntro()) showIntro();

helpBtnEl.addEventListener('click', () => {
  if (isIntroVisible(introPanelEl)) {
    hideIntro(introPanelEl);
    return;
  }
  showIntro();
  introPanelEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

resetBtnEl.addEventListener('click', () => {
  void handleReset();
});

window.addEventListener('focus', tick);
window.addEventListener('blur', tick);
document.addEventListener('visibilitychange', tick);
window.addEventListener('pagehide', () => engine.buryOwn());
window.addEventListener('beforeunload', () => engine.buryOwn());

// Restoring from the back/forward cache resurrects a tab that already buried
// itself on pagehide; without this it would sit there as a ghost of itself.
window.addEventListener('pageshow', (e) => {
  if ((e as PageTransitionEvent).persisted) {
    engine.restore();
    tick();
  }
});

channel.onMessage((msg) => {
  if (msg.type === 'reset') engine.handleRemoteReset();
  tick();
});

engine.plantSelf();
setInterval(tick, TICK_MS);
tick();
