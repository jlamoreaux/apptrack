"use client";

/**
 * Save a guest's cached comp entries to the account they just signed in to.
 *
 * Called from the app shell (so it runs whatever page the user lands on after
 * auth) and from the comp page (so the page can refresh once it's done). Both
 * share one in-flight promise, so the entries are posted exactly once.
 */

import { readGuestComp, writeGuestComp, type GuestCompEntry } from "./comp-guest-cache";

export const GUEST_COMP_IMPORTED_EVENT = "careerotter:guest-comp-imported";

export interface GuestImportResult {
  imported: number;
  /** Entries the API rejected as invalid; they are dropped rather than retried forever. */
  rejected: number;
  /** The user was not signed in after all; nothing was dropped. */
  unauthorized: boolean;
}

let inFlight: Promise<GuestImportResult | null> | null = null;

/**
 * Post every cached guest entry to the comp API. Resolves null when there is
 * nothing cached. Entries the server accepts or rejects as invalid leave the
 * cache; entries that fail for any other reason (network, 5xx, 401) stay for
 * the next attempt.
 */
export function importGuestComp(): Promise<GuestImportResult | null> {
  if (inFlight) return inFlight;
  inFlight = run().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(): Promise<GuestImportResult | null> {
  const entries = readGuestComp();
  if (entries.length === 0) return null;

  const result: GuestImportResult = { imported: 0, rejected: 0, unauthorized: false };
  const remaining: GuestCompEntry[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (result.unauthorized) {
      remaining.push(entry);
      continue;
    }
    const { id: _id, ...body } = entry;
    let status: number;
    try {
      const res = await fetch("/api/careerotter/comp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      status = res.status;
    } catch {
      status = 0;
    }
    if (status >= 200 && status < 300) {
      result.imported += 1;
    } else if (status === 401) {
      result.unauthorized = true;
      remaining.push(entry);
    } else if (status >= 400 && status < 500) {
      result.rejected += 1;
    } else {
      remaining.push(entry);
    }
  }

  writeGuestComp(remaining);
  if (result.imported > 0 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(GUEST_COMP_IMPORTED_EVENT, { detail: result }));
  }
  return result;
}
