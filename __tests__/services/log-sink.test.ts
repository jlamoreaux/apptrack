/**
 * Tests for the Workers-safe log transport that replaced Winston.
 *
 * Winston's transports are built on Node's stream/fs/os and cannot run on Cloudflare
 * Workers. These tests pin the behaviour that had to be preserved through the swap: level
 * filtering, the silent flag, default metadata, and — most importantly — that a logging
 * failure never propagates to the caller.
 */

import { createLogSink, type LogSinkOptions } from "@/lib/services/log-sink";
import { LogLevel } from "@/lib/services/logger.types";

function options(overrides: Partial<LogSinkOptions> = {}): LogSinkOptions {
  return {
    level: LogLevel.INFO,
    defaultMeta: { service: "apptrack" },
    silent: false,
    pretty: false,
    ...overrides,
  };
}

describe("createLogSink", () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("level filtering", () => {
    it("emits entries at or above the configured level", () => {
      const sink = createLogSink(options({ level: LogLevel.WARN }));

      sink.log(LogLevel.ERROR, "boom", {});
      sink.log(LogLevel.WARN, "careful", {});

      expect(logSpy).toHaveBeenCalledTimes(2);
    });

    it("drops entries below the configured level", () => {
      const sink = createLogSink(options({ level: LogLevel.WARN }));

      sink.log(LogLevel.INFO, "chatter", {});
      sink.log(LogLevel.DEBUG, "noise", {});
      sink.log(LogLevel.TRACE, "more noise", {});

      expect(logSpy).not.toHaveBeenCalled();
    });

    it("drops an unrecognised level rather than emitting it", () => {
      const sink = createLogSink(options());
      sink.log("not-a-level", "should not appear", {});
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  it("emits nothing when silent", () => {
    const sink = createLogSink(options({ silent: true }));
    sink.log(LogLevel.ERROR, "boom", {});
    expect(logSpy).not.toHaveBeenCalled();
  });

  describe("entry shape", () => {
    it("writes one JSON object per line, merging default metadata", () => {
      const sink = createLogSink(
        options({ defaultMeta: { service: "apptrack", hostname: "test-host" } })
      );

      sink.log(LogLevel.INFO, "hello", { requestId: "abc" });

      const written = JSON.parse(logSpy.mock.calls[0][0]);
      expect(written).toMatchObject({
        service: "apptrack",
        hostname: "test-host",
        requestId: "abc",
        level: LogLevel.INFO,
        message: "hello",
      });
      expect(typeof written.timestamp).toBe("string");
    });

    it("lets per-entry metadata be overridden by level and message", () => {
      // level/message are applied last so an entry cannot spoof them via metadata.
      const sink = createLogSink(options());
      sink.log(LogLevel.ERROR, "real message", {
        level: "info",
        message: "spoofed",
      });

      const written = JSON.parse(logSpy.mock.calls[0][0]);
      expect(written.level).toBe(LogLevel.ERROR);
      expect(written.message).toBe("real message");
    });

    it("writes human-readable output in pretty mode", () => {
      const sink = createLogSink(options({ pretty: true }));
      sink.log(LogLevel.INFO, "readable", {});

      const line = logSpy.mock.calls[0][0];
      expect(typeof line).toBe("string");
      expect(line).toContain("[info]");
      expect(line).toContain("readable");
      expect(() => JSON.parse(line)).toThrow(); // not JSON in pretty mode
    });
  });

  describe("Axiom ingest", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("posts to the dataset ingest endpoint when configured", () => {
      const mockFetch = jest.fn().mockResolvedValue({ ok: true } as Response);
      global.fetch = mockFetch;

      const sink = createLogSink(
        options({ axiom: { token: "tok", dataset: "logs" } })
      );
      sink.log(LogLevel.ERROR, "boom", {});

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.axiom.co/v1/datasets/logs/ingest");
      expect(init.method).toBe("POST");
      expect(init.headers.authorization).toBe("Bearer tok");
      expect(JSON.parse(init.body)).toHaveLength(1);
    });

    it("does not call fetch when Axiom is not configured", () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      createLogSink(options()).log(LogLevel.ERROR, "boom", {});

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("does not throw when the ingest request rejects", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("network down"));

      const sink = createLogSink(
        options({ axiom: { token: "tok", dataset: "logs" } })
      );

      expect(() => sink.log(LogLevel.ERROR, "boom", {})).not.toThrow();
      // Let the rejected promise settle so an unhandled rejection would surface.
      await Promise.resolve();
    });

    it("still writes to the console when Axiom is configured", () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response);

      createLogSink(options({ axiom: { token: "tok", dataset: "logs" } })).log(
        LogLevel.ERROR,
        "boom",
        {}
      );

      expect(logSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("never throws when the console write itself fails", () => {
    logSpy.mockImplementation(() => {
      throw new Error("console exploded");
    });

    const sink = createLogSink(options());
    expect(() => sink.log(LogLevel.ERROR, "boom", {})).not.toThrow();
  });
});
