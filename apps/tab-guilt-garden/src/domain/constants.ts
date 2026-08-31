// --- Tuning knobs -----------------------------------------------------
// The plot lives on a compressed internal clock so the decay is easy to
// witness in a single sitting, while the copy on screen dramatizes the
// same span into believable "hours of neglect" (see format.ts).

/** How often each tab re-reads storage, updates its own heartbeat, and re-renders. */
export const TICK_MS = 1000;

/** Broadcast a heartbeat ping to other tabs at most this often (ms). */
export const HEARTBEAT_BROADCAST_MS = 3000;

/** If a tab's heartbeat goes silent longer than this, it's presumed crashed/killed. */
export const GHOST_TIMEOUT_MS = 90_000;

/** Real time, unfocused, for a plant to wilt from full vitality (100) to death (0). */
export const DECAY_MS = 3 * 60 * 1000; // 3 minutes

/** Real time (existing, regardless of focus) for a plant to reach full maturity/bloom. */
export const GROWTH_MS = 40 * 1000; // 40 seconds

/** Vitality threshold below which a plant is considered "wilting". */
export const WILT_AT = 50;

/** Vitality threshold below which a plant is considered "dead" (still open, still savable). */
export const DEAD_AT = 4;

/**
 * Death is not the end of the idle curve. A plant left unfocused well past the
 * point of death keeps visibly degrading, so a player who walks away for a long
 * time still finds that *something happened* while they were gone. Both are
 * measured in real (unscaled) neglect time.
 */
export const HUSK_AT_MS = 6 * 60 * 1000; // 6 minutes -> 立ち枯れ
export const FOSSIL_AT_MS = 12 * 60 * 1000; // 12 minutes -> 化石化

/**
 * Multiplies real elapsed ms into the "story time" shown to the user, so a
 * 3-minute real decay reads as "3時間放置" instead of "3分放置". Purely cosmetic:
 * nothing in the simulation reads this value.
 */
export const DISPLAY_TIME_SCALE = 60;

/** Hard cap on stored tombstones, to keep localStorage from growing without bound. */
export const MAX_GRAVEYARD = 200;

export const STORAGE_KEY_PLANTS = 'tgg:plants:v1';
export const STORAGE_KEY_GRAVEYARD = 'tgg:graveyard:v1';
export const STORAGE_KEY_LEDGER = 'tgg:ledger:v1';
export const STORAGE_KEY_INTRO_SEEN = 'tgg:intro-seen:v1';
export const CHANNEL_NAME = 'tab-guilt-garden:v1';

export const EXCUSE_PLACEHOLDER = '言い訳を入力...';
export const NAME_PLACEHOLDER = '無題の罪';
