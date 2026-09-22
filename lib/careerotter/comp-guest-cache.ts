/**
 * Guest comp entries (CareerOtter comp tracker, try-before-signup).
 *
 * A visitor can use the comp page without an account. Their entries live in
 * this browser only, for a short while, so that when they sign up or log in
 * the app can save them to the new account without asking again. Nothing here
 * touches the network; storage is injected so the logic is testable.
 */

import type { CompEntry } from "./comp-projection";
import type { GuestCompEntry } from "@/types";
import { GUEST_COMP_STORAGE_KEY, GUEST_COMP_TTL_MS } from "@/lib/constants/careerotter";
import { validateCompEntryInput } from "./comp-entry-validation";

export type { CompEntryInput, GuestCompEntry } from "@/types";

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

/**
 * A stored record that passes the same validation the API applies, with the
 * API's defaults filled in; null for anything partial or malformed so it never
 * reaches the projection.
 */
function normalizeGuestEntry(value: unknown): GuestCompEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const id = (value as { id?: unknown }).id;
  if (typeof id !== "string" || id.length === 0) return null;
  const checked = validateCompEntryInput(value);
  return checked.ok ? { id, ...checked.value } : null;
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
    const entries: GuestCompEntry[] = [];
    for (const item of parsed.entries) {
      const entry = normalizeGuestEntry(item);
      if (entry) entries.push(entry);
    }
    return sortByDate(entries);
  } catch {
    return [];
  }
}

/**
 * Replace the guest's entries; the TTL restarts from now. An empty list clears
 * them. Returns false when the browser refused the write (storage blocked or
 * full), so the page can say the entries will not outlive it.
 */
export function writeGuestComp(
  entries: GuestCompEntry[],
  storage: StorageLike | null = guestStorage(),
  now: number = Date.now()
): boolean {
  if (!storage) return false;
  try {
    if (entries.length === 0) {
      storage.removeItem(GUEST_COMP_STORAGE_KEY);
      return true;
    }
    const stored: StoredGuestComp = { savedAt: now, entries: sortByDate(entries) };
    storage.setItem(GUEST_COMP_STORAGE_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

/** Remove every guest entry from the browser. */
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
