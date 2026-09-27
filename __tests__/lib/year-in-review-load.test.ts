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

  it("reports an error rather than a partial result when every page is full", async () => {
    const result = await fetchAllRows<number>(async () => ({ data: new Array(1000).fill(0), error: null }));
    expect(result.error).toBeInstanceOf(Error);
    expect(result.data).toHaveLength(20_000);
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

describe("loadYearInReview", () => {
  // A chainable stand-in for the Supabase query builder: every method returns
  // the builder, and awaiting it yields the result for the queried table.
  function client(failing: string | null) {
    return {
      from(table: string) {
        const result = table === failing
          ? { data: null, count: null, error: new Error(`${table} failed`) }
          : { data: [], count: 0, error: null };
        const builder: Record<string, unknown> = {};
        for (const m of ["select", "eq", "gte", "lte", "lt", "not", "order", "range", "limit"]) {
          builder[m] = () => builder;
        }
        builder.then = (resolve: (v: unknown) => void) => resolve(result);
        return builder;
      },
    };
  }

  async function load(failing: string | null) {
    const { createClient } = jest.requireMock("@/lib/supabase/server");
    const { createAdminClient } = jest.requireMock("@/lib/supabase/admin-client");
    createClient.mockResolvedValue(client(failing));
    createAdminClient.mockReturnValue(client(failing));
    const { loadYearInReview } = await import("@/lib/year-in-review/load");
    return loadYearInReview("user-1", 2026, new Date("2026-12-05T00:00:00Z"));
  }

  it("computes an empty year when every read succeeds", async () => {
    expect((await load(null)).volume.applications).toBe(0);
  });

  it.each(["applications", "application_history", "cover_letters", "wins"])(
    "fails the whole load when %s fails, instead of reporting zero",
    async (table) => {
      await expect(load(table)).rejects.toThrow("Failed to load year in review");
    }
  );
});
