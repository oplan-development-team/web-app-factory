// --- timing -----------------------------------------------------------

/** How often a tab re-reads shared state, advances its own earnings and re-renders the HUD. */
export const TICK_MS = 1000;

/**
 * How long a tab's presence record survives without a fresh heartbeat.
 *
 * This cannot be short. Chrome throttles timers in a hidden tab to roughly once
 * per minute, so a perfectly healthy background tab may only refresh its
 * heartbeat every 60s. Two of those intervals is the smallest value that does
 * not evict live tabs. Cleanly closed tabs do not rely on this at all -- they
 * remove themselves in `pagehide` -- so this timeout only governs the
 * crash/kill case.
 */
export const GHOST_TIMEOUT_MS = 120_000;

/**
 * Upper bound on a single accumulation step. A machine waking from sleep, a
 * clock correction, or a page restored from the back/forward cache can all
 * produce an absurd delta; crediting it verbatim would hand out millions of
 * きらめき at once.
 */
export const MAX_TICK_DELTA_MS = 300_000;

// --- economy ----------------------------------------------------------

/** Base きらめき per second, per open tab, before the 共鳴 multiplier. */
export const BASE_RATE_PER_TAB = 8;

// --- growth -----------------------------------------------------------

/**
 * Elapsed-time thresholds (ms since the tab opened) for growth stages 1..4.
 * Stage 0 is "just opened". Front-loaded on purpose: the first two steps land
 * while someone is still watching, the last one rewards actually leaving it be.
 */
export const STAGE_THRESHOLDS_MS = [30_000, 120_000, 360_000, 900_000] as const;

export const MAX_STAGE = STAGE_THRESHOLDS_MS.length;

/** Particles in a cluster: base + per-stage + per 粒子密度 level. */
export const PARTICLES_BASE = 14;
export const PARTICLES_PER_STAGE = 9;
export const PARTICLES_PER_DENSITY = 16;

// --- layout (world units) ---------------------------------------------

/** Clusters are scattered inside an annulus so nothing sits dead-centre. */
export const CLUSTER_RADIUS_MIN = 1.6;
export const CLUSTER_RADIUS_MAX = 5.4;
export const CLUSTER_DEPTH = 2.6;

/** Angular sectors used to space clusters apart without knowing how many exist. */
export const CLUSTER_SECTORS = 12;
export const CLUSTER_RADIUS_BANDS = 3;

// --- storage ----------------------------------------------------------

export const STORAGE_KEY_TABS = 'atg:tabs:v1';
export const STORAGE_KEY_PROGRESS = 'atg:progress:v1';
export const STORAGE_KEY_HINT_DISMISSED = 'atg:hint-dismissed:v1';
export const SESSION_KEY_TAB_ID = 'atg:tab-id:v1';
export const CHANNEL_NAME = 'ambient-tab-garden:v1';

/**
 * Defensive cap on the registry. Nothing should ever approach this; it exists
 * so a pathological amount of stale data cannot make every read expensive.
 */
export const MAX_TABS = 64;
