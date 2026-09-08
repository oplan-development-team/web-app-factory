import './styles/index.css';

import { SESSION_KEY_TAB_ID, TICK_MS } from './domain/constants';
import { buildClusterViews } from './domain/cluster';
import {
  advanceOwn,
  balanceOf,
  bankTabs,
  ratePerTab,
  reconcileSelf,
  totalRate,
} from './domain/glimmer';
import {
  capTabs,
  createPresence,
  longestRunning,
  partitionGhosts,
  removeTab,
  upsertOwn,
} from './domain/presence';
import type { ClusterView, TabPresence, UpgradeId } from './domain/types';
import { effectsOf, purchase, viewsOf } from './domain/upgrades';
import { GardenChannel } from './infra/channel';
import { GardenStore } from './infra/storage';
import { FaviconPainter } from './render/favicon';
import { Garden } from './render/particles';
import { createStage } from './render/scene';
import { must } from './ui/dom';
import { multiTabHint, Notices, STORAGE_NOTICE, WEBGL_NOTICE } from './ui/notices';
import { StatsPanel } from './ui/stats';
import { UpgradePanel } from './ui/upgrades';

/** A tab keeps its identity across reloads, so refreshing does not restart the cluster. */
function resolveTabId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY_TAB_ID);
    if (existing) return existing;
    const fresh = newId();
    sessionStorage.setItem(SESSION_KEY_TAB_ID, fresh);
    return fresh;
  } catch {
    // Session storage blocked: the tab still works, it just forgets itself on
    // reload and starts a new cluster.
    return newId();
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Motion multiplier, kept live so toggling the OS setting takes effect at once. */
function watchMotion(): () => number {
  const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (!query) return () => 1;
  // Drift is damped rather than frozen: a completely static field reads as a
  // broken canvas, while 18% keeps it legible as "alive but calm".
  let value = query.matches ? 0.18 : 1;
  query.addEventListener('change', (e) => {
    value = e.matches ? 0.18 : 1;
  });
  return () => value;
}

function boot(): void {
  const store = new GardenStore();
  const channel = new GardenChannel();
  const notices = new Notices();
  const stats = new StatsPanel();
  const favicon = new FaviconPainter();
  const canvas = must<HTMLCanvasElement>('#stage');
  const curtain = must<HTMLElement>('#curtain');
  const fallback = must<HTMLElement>('#fallback');

  const tabId = resolveTabId();
  let own: TabPresence = createPresence(tabId, Date.now());
  let progress = store.loadProgress();
  let clusters: ClusterView[] = [];
  let selfCluster: ClusterView | null = null;
  let hintDismissed = store.isHintDismissed();

  if (store.ephemeral) notices.show('storage', STORAGE_NOTICE);

  const upgrades = new UpgradePanel((id) => buy(id));

  /**
   * One pass of shared state: read, retire whoever is gone, advance our own
   * earnings, write back. Reading immediately before writing is what keeps two
   * tabs from clobbering each other's progress.
   */
  function tick(): void {
    const now = Date.now();
    const rate = ratePerTab(progress.levels);

    const stored = store.loadTabs();
    const { live, ghosts } = partitionGhosts(stored, now);

    if (ghosts.length > 0) {
      progress = bankTabs(progress, ghosts, now, rate);
      store.saveProgress(progress);
    }

    own = advanceOwn(reconcileSelf(live, own), now, rate);
    const tabs = capTabs(upsertOwn(live, own));
    store.saveTabs(tabs);

    render(tabs, now, rate);
  }

  function render(tabs: readonly TabPresence[], now: number, rate: number): void {
    const balance = balanceOf(progress, tabs, now, rate);
    const longest = longestRunning(tabs, now);

    stats.render({
      balance,
      tabCount: tabs.length,
      longestLabel: longest?.label ?? 'タブA',
      longestMs: longest?.ageMs ?? 0,
      ratePerSecond: totalRate(tabs.length, progress.levels),
    });
    upgrades.render(viewsOf(progress, balance));

    clusters = buildClusterViews(tabs, tabId, progress.levels, now);
    selfCluster = clusters.find((c) => c.isSelf) ?? null;
    favicon.update(selfCluster, effectsOf(progress.levels).haloScale);

    // The hint is only useful while the mechanic is still invisible.
    if (tabs.length > 1 || hintDismissed) {
      notices.hide('hint');
    } else if (!notices.has('hint')) {
      notices.show(
        'hint',
        multiTabHint(
          () => window.open(window.location.href, '_blank', 'noopener'),
          () => {
            hintDismissed = true;
            store.dismissHint();
            notices.hide('hint');
          },
        ),
      );
    }
  }

  function buy(id: UpgradeId): void {
    const now = Date.now();
    const rate = ratePerTab(progress.levels);

    // Re-read first: another tab may have spent the same きらめき a moment ago.
    const { live } = partitionGhosts(store.loadTabs(), now);
    const latest = store.loadProgress();
    const balance = balanceOf(latest, upsertOwn(live, own), now, rate);

    const next = purchase(latest, id, balance);
    if (next === latest) return;

    progress = next;
    store.saveProgress(progress);
    channel.post({ kind: 'progress' });

    upgrades.markBought(id);
    stats.flashBalance();
    tick();
  }

  channel.onMessage((msg) => {
    if (msg.kind === 'progress') progress = store.loadProgress();
    tick();
  });

  // A cleanly closed tab removes itself immediately, so other tabs do not have
  // to wait out the ghost timeout. `pagehide` fires in cases `unload` does not,
  // notably on iOS.
  window.addEventListener('pagehide', () => {
    const now = Date.now();
    const rate = ratePerTab(progress.levels);
    const departing = advanceOwn(own, now, rate);

    const latest = store.loadProgress();
    store.saveProgress(bankTabs(latest, [departing], now, rate));
    store.saveTabs(removeTab(store.loadTabs(), tabId));
    channel.post({ kind: 'left', id: tabId });
    channel.close();
  });

  // Coming back to the foreground: re-register at once rather than waiting for
  // the next throttled interval, in case this tab was frozen long enough to be
  // evicted while it was hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
  });

  tick();
  channel.post({ kind: 'joined', id: tabId });
  window.setInterval(tick, TICK_MS);

  const stage = createStage(canvas);
  if (!stage) {
    fallback.hidden = false;
    notices.show('webgl', WEBGL_NOTICE);
    revealScene(curtain);
    return;
  }

  const garden = new Garden(stage.scene, stage.maxPointSize);
  const motionOf = watchMotion();
  let lastFrame = 0;
  let revealed = false;

  stage.start((elapsed) => {
    const delta = Math.min(0.1, elapsed - lastFrame);
    lastFrame = elapsed;

    const effects = effectsOf(progress.levels);
    garden.sync(clusters, effects);
    garden.setPointScale(stage.pointScale());
    garden.update(elapsed, delta, effects, motionOf());

    if (!revealed) {
      revealed = true;
      revealScene(curtain);
    }
  });
}

/** Drops the loading curtain once there is actually something behind it. */
function revealScene(curtain: HTMLElement): void {
  curtain.classList.add('curtain--gone');
  window.setTimeout(() => curtain.remove(), 1200);
}

try {
  boot();
} catch (error) {
  // Nothing below the curtain would ever appear otherwise; better a readable
  // failure than a frozen splash.
  console.error('[ambient-tab-garden] failed to start', error);
  const curtain = document.querySelector<HTMLElement>('#curtain');
  if (curtain) {
    curtain.textContent = '';
    const message = document.createElement('p');
    message.className = 'curtain__label';
    message.textContent = '起動に失敗しました。ページを再読み込みしてください。';
    curtain.appendChild(message);
  }
}
