"use client";

/**
 * Save a guest's cached comp entries to the account they just signed in to.
 *
 * Called from the app shell (so it runs whatever page the user lands on after
 * auth) and from the comp page (so the page can refresh once it's done). Both
 * share one in-flight promise, so the entries are posted exactly once.
 */

import { readGuestComp, writeGuestComp } from "./comp-guest-cache";
import type { GuestCompEntry } from "@/types";

export const GUEST_COMP_IMPORTED_EVENT = "careerotter:guest-comp-imported";

export interface GuestImportResult {
  imported: number;
  /** Entries the API rejected as invalid; they are dropped rather than retried forever. */
  rejected: number;
  /** The user was not signed in after all; nothing was dropped. */
  unauthorized: boolean;
  /**
   * False when the browser refused to update the cache mid-import. The run
   * stopped at that point, so the cache still lists what it had already
   * posted and a later attempt may save those again.
   */
  persisted: boolean;
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

/** POST one entry; the HTTP status, or 0 when the request never completed. */
async function postEntry(entry: GuestCompEntry): Promise<number> {
  const { id: _id, ...body } = entry;
  try {
    const res = await fetch("/api/careerotter/comp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.status;
  } catch {
    return 0;
  }
}

/**
 * The import itself. The cache is rewritten after every response, so an entry
 * the server has accepted is gone from the browser before the next request
 * starts; a reload mid-import cannot post it twice.
 */
async function run(): Promise<GuestImportResult | null> {
  const entries = readGuestComp();
  if (entries.length === 0) return null;

  const result: GuestImportResult = {
    imported: 0,
    rejected: 0,
    unauthorized: false,
    persisted: true,
  };
  const kept: GuestCompEntry[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (result.unauthorized) {
      kept.push(entry);
      continue;
    }
    const status = await postEntry(entry);
    if (status >= 200 && status < 300) {
      result.imported += 1;
    } else if (status === 401) {
      result.unauthorized = true;
      kept.push(entry);
    } else if (status >= 400 && status < 500) {
      result.rejected += 1;
    } else {
      kept.push(entry);
    }
    // Checkpoint: what is still to try, plus what this pass decided to keep.
    if (!writeGuestComp([...kept, ...entries.slice(i + 1)])) {
      // The cache still lists what this pass already posted, so every further
      // post would be one more duplicate on the next attempt. Stop here; the
      // entries not yet sent are still cached for that attempt.
      result.persisted = false;
      break;
    }
  }

  if (result.imported > 0 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(GUEST_COMP_IMPORTED_EVENT, { detail: result }));
  }
  return result;
}
