/**
 * Guest comp import: posts what the browser cached to the account, once,
 * and only forgets entries the server accepted or rejected as invalid.
 */

import {
  GUEST_COMP_IMPORTED_EVENT,
  importGuestComp,
} from "@/lib/careerotter/comp-guest-import";
import {
  GUEST_COMP_STORAGE_KEY,
  readGuestComp,
  writeGuestComp,
  type GuestCompEntry,
} from "@/lib/careerotter/comp-guest-cache";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const entry = (id: string, date: string): GuestCompEntry => ({
  id,
  effective_date: date,
  base: 100_000,
  bonus: 0,
  equity: 0,
  ticker: null,
  shares: null,
  vest_start: null,
  vest_years: null,
  vest_cliff_months: null,
});

beforeEach(() => {
  window.localStorage.clear();
  mockFetch.mockReset();
});

it("resolves null with nothing cached and makes no request", async () => {
  expect(await importGuestComp()).toBeNull();
  expect(mockFetch).not.toHaveBeenCalled();
});

it("posts every entry oldest first, clears the cache, and announces it", async () => {
  writeGuestComp([entry("b", "2026-03-01"), entry("a", "2025-01-01")]);
  mockFetch.mockResolvedValue({ status: 201, ok: true });
  const heard = jest.fn();
  window.addEventListener(GUEST_COMP_IMPORTED_EVENT, heard);

  const result = await importGuestComp();

  expect(result).toEqual({ imported: 2, rejected: 0, unauthorized: false });
  expect(mockFetch).toHaveBeenCalledTimes(2);
  const bodies = mockFetch.mock.calls.map((c) => JSON.parse(c[1].body));
  expect(bodies.map((b) => b.effective_date)).toEqual(["2025-01-01", "2026-03-01"]);
  // The local id never reaches the API.
  expect(bodies[0]).not.toHaveProperty("id");
  expect(window.localStorage.getItem(GUEST_COMP_STORAGE_KEY)).toBeNull();
  expect(heard).toHaveBeenCalledTimes(1);
});

it("keeps everything when the user turns out not to be signed in", async () => {
  writeGuestComp([entry("a", "2025-01-01"), entry("b", "2026-03-01")]);
  mockFetch.mockResolvedValue({ status: 401, ok: false });

  const result = await importGuestComp();

  expect(result).toEqual({ imported: 0, rejected: 0, unauthorized: true });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(readGuestComp().map((e) => e.id)).toEqual(["a", "b"]);
});

it("drops an entry the API rejects but keeps one that failed on the way", async () => {
  writeGuestComp([entry("bad", "2025-01-01"), entry("flaky", "2026-03-01")]);
  mockFetch
    .mockResolvedValueOnce({ status: 400, ok: false })
    .mockRejectedValueOnce(new TypeError("Failed to fetch"));

  const result = await importGuestComp();

  expect(result).toEqual({ imported: 0, rejected: 1, unauthorized: false });
  expect(readGuestComp().map((e) => e.id)).toEqual(["flaky"]);
});

it("shares one in-flight import between concurrent callers", async () => {
  writeGuestComp([entry("a", "2025-01-01")]);
  mockFetch.mockResolvedValue({ status: 201, ok: true });

  const [first, second] = await Promise.all([importGuestComp(), importGuestComp()]);

  expect(first).toBe(second);
  expect(mockFetch).toHaveBeenCalledTimes(1);
});
