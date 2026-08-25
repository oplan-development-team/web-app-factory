import { type DraftSnapshot, parseDraft, serializeDraft } from "./draft";

export const DRAFT_STORAGE_KEY = "signature-ribbon-poster:draft";

function isUsableStorage(candidate: unknown): candidate is Storage {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof (candidate as Storage).getItem === "function" &&
    typeof (candidate as Storage).setItem === "function" &&
    typeof (candidate as Storage).removeItem === "function"
  );
}

/**
 * Feature-detects rather than existence-checks: some hosts expose a `localStorage`
 * global that is present but not a working Storage, and merely reading `typeof`
 * would let a broken object through.
 */
function ambientStorage(): Storage | null {
  try {
    const candidate =
      typeof window !== "undefined" && window.localStorage
        ? window.localStorage
        : (globalThis as { localStorage?: unknown }).localStorage;
    return isUsableStorage(candidate) ? candidate : null;
  } catch {
    // Accessing localStorage throws outright when storage is blocked by policy.
    return null;
  }
}

/**
 * localStorage-backed draft persistence. Storage is a best-effort convenience, so
 * every operation degrades to a no-op rather than propagating an error: the app
 * must keep working in private mode or over quota (FR-011.5, E-08).
 */
export class DraftStorage {
  private readonly backing: Storage | null;

  constructor(backing: Storage | null = ambientStorage()) {
    this.backing = backing;
  }

  /** @returns false when the draft could not be persisted. */
  save(snapshot: DraftSnapshot): boolean {
    if (!this.backing) {
      return false;
    }
    try {
      this.backing.setItem(DRAFT_STORAGE_KEY, JSON.stringify(serializeDraft(snapshot)));
      return true;
    } catch {
      return false;
    }
  }

  load(): DraftSnapshot | null {
    if (!this.backing) {
      return null;
    }

    let raw: string | null;
    try {
      raw = this.backing.getItem(DRAFT_STORAGE_KEY);
    } catch {
      return null;
    }
    if (raw === null) {
      return null;
    }

    const parsed = parseDraft(raw);
    if (!parsed) {
      this.clear();
      return null;
    }
    return parsed;
  }

  clear(): void {
    if (!this.backing) {
      return;
    }
    try {
      this.backing.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Nothing sensible to do; the draft simply stays behind.
    }
  }
}
