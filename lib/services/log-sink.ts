/**
 * Workers-safe log transport.
 *
 * Replaces Winston, whose transports are built on Node's `stream`, `fs` and `os` — none of
 * which exist on Cloudflare Workers. `LoggerService` used exactly one Winston method
 * (`logger.log(level, message, meta)`), so this exposes the same shape and nothing above it
 * changes.
 *
 * Two sinks, both fetch/console only:
 *
 *   - **Console.** Structured JSON on one line. Cloudflare Workers Logs ingests
 *     `console.log` natively with no configuration, so this is the destination the app is
 *     moving to. Human-readable formatting is used outside production.
 *   - **Axiom.** Direct HTTP ingest, retained so nothing is lost while the app still runs
 *     on Vercel. Once traffic is on Workers, Workers Logs supersedes it and this sink and
 *     its two environment variables can be deleted.
 *
 * Log writes are fire-and-forget. A logging failure must never fail or delay a request, and
 * must never throw into the caller.
 */

import { LogLevel } from "./logger.types";

/** Ordered most severe to least. Used for threshold comparison. */
const LEVEL_SEVERITY: Record<string, number> = {
  [LogLevel.ERROR]: 0,
  [LogLevel.WARN]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.DEBUG]: 3,
  [LogLevel.TRACE]: 4,
};

const AXIOM_INGEST_TIMEOUT_MS = 3_000;

export interface LogSinkOptions {
  /** Minimum severity to emit. Entries less severe than this are dropped. */
  level: string;
  /** Emitted with every entry so records are attributable. */
  defaultMeta: Record<string, unknown>;
  /** Suppresses all output. */
  silent: boolean;
  /** Human-readable console output instead of JSON. */
  pretty: boolean;
  axiom?: { token: string; dataset: string };
}

export interface LogSink {
  log(level: string, message: string, meta: Record<string, unknown>): void;
}

/**
 * Posts a single entry to Axiom.
 *
 * Deliberately not batched. Batching needs a flush timer, and a module-scope timer cannot
 * run on Workers — the exact constraint that made Winston unusable. At this app's log
 * volume one request per entry is acceptable; if that changes, batch per-request and flush
 * via `ctx.waitUntil` rather than reintroducing a timer.
 */
function postToAxiom(
  config: { token: string; dataset: string },
  entry: Record<string, unknown>
): void {
  void fetch(
    `https://api.axiom.co/v1/datasets/${encodeURIComponent(config.dataset)}/ingest`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([entry]),
      signal: AbortSignal.timeout(AXIOM_INGEST_TIMEOUT_MS),
    }
  ).catch(() => {
    // Swallowed on purpose: a logging failure must not surface to the caller, and
    // reporting it through the logger would risk a loop.
  });
}

function writeToConsole(
  level: string,
  message: string,
  entry: Record<string, unknown>,
  pretty: boolean
): void {
  if (pretty) {
    const { timestamp, ...rest } = entry;
    const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
    console.log(`${timestamp} [${level}] ${message}${extra}`);
    return;
  }
  // One JSON object per line — what Workers Logs and every log drain expect.
  console.log(JSON.stringify(entry));
}

export function createLogSink(options: LogSinkOptions): LogSink {
  const threshold = LEVEL_SEVERITY[options.level] ?? LEVEL_SEVERITY[LogLevel.INFO];

  return {
    log(level, message, meta) {
      if (options.silent) return;

      const severity = LEVEL_SEVERITY[level];
      if (severity === undefined || severity > threshold) return;

      const entry = {
        ...options.defaultMeta,
        ...meta,
        level,
        message,
        timestamp: new Date().toISOString(),
      };

      try {
        writeToConsole(level, message, entry, options.pretty);
        if (options.axiom) postToAxiom(options.axiom, entry);
      } catch {
        // Never throw from a log write.
      }
    },
  };
}
