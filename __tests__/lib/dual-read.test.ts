/**
 * Tests for the Supabase → Drizzle rollout gate.
 *
 * The invariant that matters most is that shadow mode is genuinely zero-risk: the legacy
 * result is always what callers receive, and a failure in the Drizzle path — including a
 * thrown error — must never reach them. If that were wrong, enabling shadow mode to *gather*
 * evidence would itself be the outage.
 */

import { dualRead, drizzleMode } from "@/lib/db/dual-read";

jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
  LogLevel: {},
  LogCategory: { DATABASE: "database" },
}));

const { loggerService } = jest.requireMock("@/lib/services/logger.service");

describe("drizzleMode", () => {
  const original = process.env.DRIZZLE_MODE;
  afterEach(() => {
    process.env.DRIZZLE_MODE = original;
  });

  it.each([
    [undefined, "off"],
    ["", "off"],
    ["off", "off"],
    ["shadow", "shadow"],
    ["on", "on"],
    ["nonsense", "off"],
  ])("maps %p to %p", (value, expected) => {
    if (value === undefined) delete process.env.DRIZZLE_MODE;
    else process.env.DRIZZLE_MODE = value;
    expect(drizzleMode()).toBe(expected);
  });

  it("defaults to off, so an unset environment never touches Drizzle", () => {
    delete process.env.DRIZZLE_MODE;
    expect(drizzleMode()).toBe("off");
  });
});

describe("dualRead", () => {
  const original = process.env.DRIZZLE_MODE;

  beforeEach(() => jest.clearAllMocks());
  afterEach(() => {
    process.env.DRIZZLE_MODE = original;
  });

  it("does not invoke the Drizzle path at all when off", async () => {
    process.env.DRIZZLE_MODE = "off";
    const drizzle = jest.fn();

    const result = await dualRead("q", async () => "legacy", drizzle);

    expect(result).toBe("legacy");
    expect(drizzle).not.toHaveBeenCalled();
  });

  it("returns the Drizzle result when on", async () => {
    process.env.DRIZZLE_MODE = "on";
    const legacy = jest.fn();

    const result = await dualRead("q", legacy, async () => "drizzle");

    expect(result).toBe("drizzle");
    expect(legacy).not.toHaveBeenCalled();
  });

  describe("shadow mode", () => {
    beforeEach(() => {
      process.env.DRIZZLE_MODE = "shadow";
    });

    it("runs both but returns the legacy result", async () => {
      const drizzle = jest.fn().mockResolvedValue("drizzle");

      const result = await dualRead("q", async () => "legacy", drizzle);

      expect(result).toBe("legacy");
      expect(drizzle).toHaveBeenCalled();
    });

    it("logs a mismatch without failing the request", async () => {
      const result = await dualRead(
        "getApplications",
        async () => [{ id: 1 }],
        async () => [{ id: 2 }]
      );

      expect(result).toEqual([{ id: 1 }]);
      expect(loggerService.warn).toHaveBeenCalledWith(
        "Drizzle shadow read mismatch",
        expect.objectContaining({
          metadata: expect.objectContaining({ query: "getApplications" }),
        })
      );
    });

    it("never puts row contents in the log, only sizes", async () => {
      // Query results are user data; a mismatch log must not become a data leak.
      await dualRead(
        "q",
        async () => [{ email: "legacy@example.com" }],
        async () => [{ email: "drizzle@example.com" }]
      );

      const logged = JSON.stringify(loggerService.warn.mock.calls[0]);
      expect(logged).not.toContain("legacy@example.com");
      expect(logged).not.toContain("drizzle@example.com");
      expect(logged).toContain("legacySize");
    });

    it("swallows a Drizzle failure and still returns the legacy result", async () => {
      const result = await dualRead(
        "q",
        async () => "legacy",
        async () => {
          throw new Error("connection refused");
        }
      );

      expect(result).toBe("legacy");
      expect(loggerService.warn).toHaveBeenCalledWith(
        "Drizzle shadow read failed",
        expect.anything()
      );
    });

    it("treats results equal despite key order and row order", async () => {
      // Only a genuine data difference should be reported; incidental ordering is noise
      // that would train people to ignore the alert.
      await dualRead(
        "q",
        async () => [{ a: 1, b: 2 }, { a: 3, b: 4 }],
        async () => [{ b: 4, a: 3 }, { b: 2, a: 1 }]
      );

      expect(loggerService.warn).not.toHaveBeenCalled();
    });
  });
});
