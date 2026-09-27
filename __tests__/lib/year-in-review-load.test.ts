/**
 * @jest-environment node
 */
import { fetchAllRows } from "@/lib/year-in-review/load";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/services/logger.service", () => ({ loggerService: { error: jest.fn() } }));

describe("fetchAllRows", () => {
  it("keeps reading while pages come back full", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => i);
    const ranges: Array<[number, number]> = [];
    const result = await fetchAllRows<number>(async (from, to) => {
      ranges.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    });
    expect(result.data).toHaveLength(2500);
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("stops after one short page", async () => {
    const build = jest.fn(async () => ({ data: [1, 2, 3], error: null }));
    expect((await fetchAllRows<number>(build)).data).toEqual([1, 2, 3]);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it("returns what it has plus the error when a page fails", async () => {
    const error = new Error("boom");
    const result = await fetchAllRows<number>(async (from) =>
      from === 0 ? { data: new Array(1000).fill(0), error: null } : { data: null, error }
    );
    expect(result.error).toBe(error);
    expect(result.data).toHaveLength(1000);
  });
});
