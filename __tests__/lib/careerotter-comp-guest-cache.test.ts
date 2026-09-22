// @jest-environment node
/**
 * Guest comp cache: a short-lived, browser-only store for entries made
 * before signing up. Storage is injected, so this runs without a DOM.
 */

import {
  GUEST_COMP_STORAGE_KEY,
  GUEST_COMP_TTL_MS,
  readGuestComp,
  toCompEntry,
  writeGuestComp,
  type GuestCompEntry,
} from "@/lib/careerotter/comp-guest-cache";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

const entry = (id: string, date: string): GuestCompEntry => ({
  id,
  effective_date: date,
  base: 155_000,
  bonus: 37_000,
  equity: 0,
  ticker: "NET",
  shares: 1_200,
  vest_start: date,
  vest_years: 4,
  vest_cliff_months: 12,
});

it("round-trips entries, oldest first, within the TTL", () => {
  const storage = memoryStorage();
  const t0 = 1_700_000_000_000;
  writeGuestComp([entry("b", "2026-06-01"), entry("a", "2024-02-01")], storage, t0);
  const read = readGuestComp(storage, t0 + GUEST_COMP_TTL_MS - 1);
  expect(read.map((e) => e.id)).toEqual(["a", "b"]);
});

it("drops and removes entries once the TTL has passed", () => {
  const storage = memoryStorage();
  const t0 = 1_700_000_000_000;
  writeGuestComp([entry("a", "2026-06-01")], storage, t0);
  expect(readGuestComp(storage, t0 + GUEST_COMP_TTL_MS + 1)).toEqual([]);
  expect(storage.map.has(GUEST_COMP_STORAGE_KEY)).toBe(false);
});

it("restarts the TTL on every write", () => {
  const storage = memoryStorage();
  const t0 = 1_700_000_000_000;
  writeGuestComp([entry("a", "2026-06-01")], storage, t0);
  const later = t0 + GUEST_COMP_TTL_MS - 1000;
  writeGuestComp([...readGuestComp(storage, later), entry("b", "2026-07-01")], storage, later);
  expect(readGuestComp(storage, t0 + GUEST_COMP_TTL_MS + 1000)).toHaveLength(2);
});

it("treats unreadable or malformed data as empty and clears it", () => {
  const storage = memoryStorage();
  storage.setItem(GUEST_COMP_STORAGE_KEY, "not json");
  expect(readGuestComp(storage)).toEqual([]);
  storage.setItem(GUEST_COMP_STORAGE_KEY, JSON.stringify({ entries: "nope" }));
  expect(readGuestComp(storage)).toEqual([]);
  expect(storage.map.has(GUEST_COMP_STORAGE_KEY)).toBe(false);
  storage.setItem(
    GUEST_COMP_STORAGE_KEY,
    JSON.stringify({ savedAt: Date.now(), entries: [entry("ok", "2026-01-01"), { id: 1 }] })
  );
  expect(readGuestComp(storage).map((e) => e.id)).toEqual(["ok"]);
});

it("clears the store when written an empty list, and copes without storage", () => {
  const storage = memoryStorage();
  writeGuestComp([entry("a", "2026-06-01")], storage);
  writeGuestComp([], storage);
  expect(storage.map.has(GUEST_COMP_STORAGE_KEY)).toBe(false);
  expect(readGuestComp(null)).toEqual([]);
  expect(() => writeGuestComp([entry("a", "2026-06-01")], null)).not.toThrow();
});

it("renders a guest entry in the page's shape", () => {
  expect(toCompEntry(entry("a", "2026-06-01"))).toMatchObject({
    id: "a",
    currency: "USD",
    note: null,
    base: 155_000,
  });
});
