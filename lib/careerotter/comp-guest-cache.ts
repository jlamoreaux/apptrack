/**
 * Guest comp entries (CareerOtter comp tracker, try-before-signup).
 *
 * A visitor can use the comp page without an account. Their entries live in
 * this browser only, for a short while, so that when they sign up or log in
 * the app can save them to the new account without asking again. Nothing here
 * touches the network; storage is injected so the logic is testable.
 */

import type { CompEntry } from "./comp-projection";

export const GUEST_COMP_STORAGE_KEY = "careerotter.guest-comp.v1";

/** How long a guest's entries survive in the browser before they are dropped. */
export const GUEST_COMP_TTL_MS = 24 * 60 * 60 * 1000;

/** What the entry form collects: the POST body for /api/careerotter/comp. */
export interface CompEntryInput {
  effective_date: string;
  base: number;
  bonus: number;
  equity: number;
  ticker: string | null;
  shares: number | null;
  vest_start: string | null;
  vest_years: number | null;
  vest_cliff_months: number | null;
}

/** A guest entry: the input plus a local id so the page can render and delete it. */
export interface GuestCompEntry extends CompEntryInput {
  id: string;
}

interface StoredGuestComp {
  savedAt: number;
  entries: GuestCompEntry[];
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The browser's localStorage when it is usable, else null (SSR, private mode). */
export function guestStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function isGuestEntry(value: unknown): value is GuestCompEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.effective_date === "string" &&
    typeof v.base === "number" &&
    Number.isFinite(v.base)
  );
}

/**
 * The guest's entries, oldest first, or an empty list when there are none or
 * they have expired. Expired or unreadable data is removed on read.
 */
export function readGuestComp(
  storage: StorageLike | null = guestStorage(),
  now: number = Date.now()
): GuestCompEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(GUEST_COMP_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredGuestComp>;
    if (typeof parsed.savedAt !== "number" || !Array.isArray(parsed.entries)) {
      storage.removeItem(GUEST_COMP_STORAGE_KEY);
      return [];
    }
    if (now - parsed.savedAt > GUEST_COMP_TTL_MS) {
      storage.removeItem(GUEST_COMP_STORAGE_KEY);
      return [];
    }
    return sortByDate(parsed.entries.filter(isGuestEntry));
  } catch {
    return [];
  }
}

/** Replace the guest's entries; the TTL restarts from now. An empty list clears them. */
export function writeGuestComp(
  entries: GuestCompEntry[],
  storage: StorageLike | null = guestStorage(),
  now: number = Date.now()
): void {
  if (!storage) return;
  try {
    if (entries.length === 0) {
      storage.removeItem(GUEST_COMP_STORAGE_KEY);
      return;
    }
    const stored: StoredGuestComp = { savedAt: now, entries: sortByDate(entries) };
    storage.setItem(GUEST_COMP_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Quota or privacy mode: the page still works, the entries just won't outlive it.
  }
}

export function clearGuestComp(storage: StorageLike | null = guestStorage()): void {
  writeGuestComp([], storage);
}

/** A local id for a guest entry; unique enough for one browser's list. */
export function newGuestId(): string {
  return `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Ascending by effective date, the order the API returns entries in. */
export function sortByDate<T extends { effective_date: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => a.effective_date.localeCompare(b.effective_date));
}

/** A guest entry in the shape the page renders. */
export function toCompEntry(entry: GuestCompEntry): CompEntry {
  return { ...entry, currency: "USD", note: null };
}
