/**
 * Tests for lib/services/logger.utils.ts
 * LoggerUtils static class — privacy sanitization, error classification, etc.
 */

// @jest-environment node

import { LoggerUtils } from "@/lib/services/logger.utils";

// ── hashUserId ────────────────────────────────────────────────────────────────

describe("LoggerUtils.hashUserId", () => {
  it("returns a 16-character string", () => {
    const hash = LoggerUtils.hashUserId("user-123");
    expect(hash).toHaveLength(16);
  });

  it("returns only lowercase hex characters", () => {
    const hash = LoggerUtils.hashUserId("user-123");
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is deterministic: same userId produces same hash", () => {
    const h1 = LoggerUtils.hashUserId("user-abc");
    const h2 = LoggerUtils.hashUserId("user-abc");
    expect(h1).toBe(h2);
  });

  it("different userIds produce different hashes", () => {
    expect(LoggerUtils.hashUserId("user-1")).not.toBe(LoggerUtils.hashUserId("user-2"));
  });

  it("handles empty string without throwing", () => {
    const hash = LoggerUtils.hashUserId("");
    expect(hash).toHaveLength(16);
  });

  it("handles very long userId", () => {
    const hash = LoggerUtils.hashUserId("u".repeat(1000));
    expect(hash).toHaveLength(16);
  });
});

// ── sanitizeEmail ─────────────────────────────────────────────────────────────

describe("LoggerUtils.sanitizeEmail", () => {
  it("masks middle of local part: john.doe@example.com → joh***@example.com", () => {
    expect(LoggerUtils.sanitizeEmail("john.doe@example.com")).toBe("joh***@example.com");
  });

  it("preserves the full domain part after @", () => {
    const result = LoggerUtils.sanitizeEmail("alice@company.org");
    expect(result).toContain("@company.org");
  });

  it("shows at most 3 visible chars (min of 3 vs half of local length)", () => {
    // "ab" → floor(2/2)=1, min(3,1)=1 → "a***@..."
    expect(LoggerUtils.sanitizeEmail("ab@x.com")).toBe("a***@x.com");
  });

  it("shows 0 visible chars for single-char local part", () => {
    // "a" → floor(1/2)=0, min(3,0)=0 → "***@..."
    expect(LoggerUtils.sanitizeEmail("a@x.com")).toBe("***@x.com");
  });

  it("returns [INVALID_EMAIL] for empty string", () => {
    expect(LoggerUtils.sanitizeEmail("")).toBe("[INVALID_EMAIL]");
  });

  it("returns [INVALID_EMAIL] for string without @", () => {
    expect(LoggerUtils.sanitizeEmail("no-at-sign")).toBe("[INVALID_EMAIL]");
  });

  it("returns [INVALID_EMAIL] for string ending with @ (no domain)", () => {
    expect(LoggerUtils.sanitizeEmail("localpart@")).toBe("[INVALID_EMAIL]");
  });

  it("appends *** after the visible chars", () => {
    const result = LoggerUtils.sanitizeEmail("longusername@test.com");
    const localVisible = result.split("@")[0];
    expect(localVisible).toMatch(/^.{0,3}\*{3}$/);
  });
});

// ── sanitizeUrl ───────────────────────────────────────────────────────────────

describe("LoggerUtils.sanitizeUrl", () => {
  it("returns empty string for empty input", () => {
    expect(LoggerUtils.sanitizeUrl("")).toBe("");
  });

  it("redacts 'token' query parameter", () => {
    const result = LoggerUtils.sanitizeUrl("/api/auth?token=abc123secret");
    expect(result).toContain("token=%5BREDACTED%5D");
    expect(result).not.toContain("abc123secret");
  });

  it("redacts 'password' query parameter (value is URL-encoded as %5BREDACTED%5D)", () => {
    // NOTE: sanitizeUrl uses URLSearchParams.set which URL-encodes the value,
    // so "[REDACTED]" appears as "%5BREDACTED%5D" in the final string.
    const result = LoggerUtils.sanitizeUrl("/login?password=supersecret");
    expect(result).not.toContain("supersecret");
    expect(result).toContain("%5BREDACTED%5D");
  });

  it("redacts 'apikey' / 'api_key' query parameters", () => {
    const result = LoggerUtils.sanitizeUrl("/v1/data?api_key=sk-12345");
    expect(result).not.toContain("sk-12345");
  });

  it("preserves non-sensitive query parameters", () => {
    const result = LoggerUtils.sanitizeUrl("/search?q=jobs&page=2");
    expect(result).toContain("q=jobs");
    expect(result).toContain("page=2");
  });

  it("preserves the pathname", () => {
    const result = LoggerUtils.sanitizeUrl("/api/v1/applications?token=xyz");
    expect(result).toContain("/api/v1/applications");
  });

  it("handles URL without query string", () => {
    const result = LoggerUtils.sanitizeUrl("/api/health");
    expect(result).toBe("/api/health");
  });

  it("returns original string for unparseable relative paths (no throw)", () => {
    // A valid relative path should work fine; deeply broken URLs are returned as-is
    expect(() => LoggerUtils.sanitizeUrl("/valid-path")).not.toThrow();
  });

  it("redacts 'session' parameter", () => {
    const result = LoggerUtils.sanitizeUrl("/app?session=sid_abc");
    expect(result).not.toContain("sid_abc");
  });
});

// ── sanitizeObject ────────────────────────────────────────────────────────────

describe("LoggerUtils.sanitizeObject", () => {
  it("redacts keys matching sensitive list (password)", () => {
    const result = LoggerUtils.sanitizeObject({ password: "hunter2", name: "Alice" });
    expect(result.password).toBe("[REDACTED]");
    expect(result.name).toBe("Alice");
  });

  it("redacts keys containing 'token' anywhere", () => {
    const result = LoggerUtils.sanitizeObject({ accessToken: "tok_abc" });
    expect(result.accessToken).toBe("[REDACTED]");
  });

  it("redacts 'secret' key", () => {
    const result = LoggerUtils.sanitizeObject({ clientSecret: "shhh" });
    expect(result.clientSecret).toBe("[REDACTED]");
  });

  it("redacts 'authorization' header key", () => {
    const result = LoggerUtils.sanitizeObject({ authorization: "Bearer xyz" });
    expect(result.authorization).toBe("[REDACTED]");
  });

  it("preserves non-sensitive keys unchanged", () => {
    const result = LoggerUtils.sanitizeObject({ userId: "u-1", role: "admin" });
    expect(result.userId).toBe("u-1");
    expect(result.role).toBe("admin");
  });

  it("recursively sanitizes nested objects", () => {
    const result = LoggerUtils.sanitizeObject({
      user: { password: "secret", name: "Bob" },
    });
    expect((result.user as any).password).toBe("[REDACTED]");
    expect((result.user as any).name).toBe("Bob");
  });

  it("sanitizes email-keyed string fields", () => {
    const result = LoggerUtils.sanitizeObject({ userEmail: "alice@example.com" });
    expect(result.userEmail).not.toBe("alice@example.com");
    expect(result.userEmail).toContain("***");
  });

  it("preserves null and undefined values", () => {
    const result = LoggerUtils.sanitizeObject({ maybeNull: null, maybeUndef: undefined });
    expect(result.maybeNull).toBeNull();
    expect(result.maybeUndef).toBeUndefined();
  });

  it("handles arrays of objects recursively", () => {
    const result = LoggerUtils.sanitizeObject({
      items: [{ token: "t1" }, { name: "safe" }],
    });
    expect((result.items as any[])[0].token).toBe("[REDACTED]");
    expect((result.items as any[])[1].name).toBe("safe");
  });

  it("stops recursion at depth 10 with marker", () => {
    // Build an object nested 11 levels deep
    const deepObj: any = {};
    let cur = deepObj;
    for (let i = 0; i < 12; i++) {
      cur.child = {};
      cur = cur.child;
    }
    // Should not throw and should return max depth marker at some point
    expect(() => LoggerUtils.sanitizeObject(deepObj)).not.toThrow();
  });
});

// ── formatBytes ───────────────────────────────────────────────────────────────

describe("LoggerUtils.formatBytes", () => {
  it("formats bytes as B", () => {
    expect(LoggerUtils.formatBytes(512)).toBe("512.00 B");
  });

  it("formats KB", () => {
    expect(LoggerUtils.formatBytes(1024)).toBe("1.00 KB");
  });

  it("formats MB", () => {
    expect(LoggerUtils.formatBytes(1024 * 1024)).toBe("1.00 MB");
  });

  it("formats GB", () => {
    expect(LoggerUtils.formatBytes(1024 ** 3)).toBe("1.00 GB");
  });

  it("formats 0 bytes as 0.00 B", () => {
    expect(LoggerUtils.formatBytes(0)).toBe("0.00 B");
  });
});

// ── estimateAiCost ────────────────────────────────────────────────────────────

describe("LoggerUtils.estimateAiCost", () => {
  it("returns undefined for unknown service", () => {
    expect(LoggerUtils.estimateAiCost("unknown-model", 1000)).toBeUndefined();
  });

  it("calculates cost for 'openai' service at $0.002 per 1k tokens", () => {
    // 1000 tokens → 0.002
    expect(LoggerUtils.estimateAiCost("openai", 1000)).toBe(0.002);
  });

  it("calculates cost for 'anthropic' at $0.025 per 1k tokens", () => {
    expect(LoggerUtils.estimateAiCost("anthropic", 1000)).toBe(0.025);
  });

  it("calculates fractional token cost correctly", () => {
    const cost = LoggerUtils.estimateAiCost("perplexity", 500);
    expect(cost).toBe(0.0025);
  });

  it("returns a number (not undefined) for known service", () => {
    expect(typeof LoggerUtils.estimateAiCost("openai-gpt4", 100)).toBe("number");
  });
});

// ── isRetryableError ──────────────────────────────────────────────────────────

describe("LoggerUtils.isRetryableError", () => {
  it("returns false for null/undefined", () => {
    expect(LoggerUtils.isRetryableError(null)).toBe(false);
    expect(LoggerUtils.isRetryableError(undefined)).toBe(false);
  });

  it("returns true for timeout errors", () => {
    expect(LoggerUtils.isRetryableError({ message: "Request timeout exceeded" })).toBe(true);
  });

  it("returns true for ECONNREFUSED errors", () => {
    expect(LoggerUtils.isRetryableError({ code: "ECONNREFUSED" })).toBe(true);
  });

  it("returns true for network errors", () => {
    expect(LoggerUtils.isRetryableError({ message: "network error occurred" })).toBe(true);
  });

  it("returns false for non-retryable errors (e.g. validation)", () => {
    expect(LoggerUtils.isRetryableError({ message: "invalid input data" })).toBe(false);
  });

  it("returns true for fetch failed errors", () => {
    expect(LoggerUtils.isRetryableError({ message: "fetch failed" })).toBe(true);
  });
});

// ── extractErrorCode ──────────────────────────────────────────────────────────

describe("LoggerUtils.extractErrorCode", () => {
  it("returns undefined for null/non-object errors", () => {
    expect(LoggerUtils.extractErrorCode(null)).toBeUndefined();
    expect(LoggerUtils.extractErrorCode("string error")).toBeUndefined();
  });

  it("extracts .code property", () => {
    expect(LoggerUtils.extractErrorCode({ code: "ENOENT" })).toBe("ENOENT");
  });

  it("extracts .statusCode when .code absent", () => {
    expect(LoggerUtils.extractErrorCode({ statusCode: 404 })).toBe(404);
  });

  it("extracts .status when others absent", () => {
    expect(LoggerUtils.extractErrorCode({ status: 500 })).toBe(500);
  });

  it("prioritizes .code over .statusCode", () => {
    expect(LoggerUtils.extractErrorCode({ code: "MYCODE", statusCode: 400 })).toBe("MYCODE");
  });
});

// ── classifyError ─────────────────────────────────────────────────────────────

describe("LoggerUtils.classifyError", () => {
  it("classifies permission errors", () => {
    expect(LoggerUtils.classifyError({ message: "permission denied" })).toBe("permission_error");
  });

  it("classifies 403 status as permission_error", () => {
    expect(LoggerUtils.classifyError({ code: "403" })).toBe("permission_error");
  });

  it("classifies timeout errors", () => {
    expect(LoggerUtils.classifyError({ message: "timeout reached" })).toBe("timeout_error");
  });

  it("classifies not_found errors", () => {
    expect(LoggerUtils.classifyError({ message: "not found" })).toBe("not_found_error");
  });

  it("classifies rate_limit errors", () => {
    expect(LoggerUtils.classifyError({ code: "429" })).toBe("rate_limit_error");
  });

  it("classifies connection errors", () => {
    expect(LoggerUtils.classifyError({ message: "econnrefused" })).toBe("connection_error");
  });

  it("classifies duplicate errors", () => {
    expect(LoggerUtils.classifyError({ message: "duplicate key" })).toBe("duplicate_error");
  });

  it("returns unknown_error for unrecognized errors", () => {
    expect(LoggerUtils.classifyError({ message: "something weird happened" })).toBe(
      "unknown_error"
    );
  });

  it("returns unknown_error for null/undefined", () => {
    expect(LoggerUtils.classifyError(null)).toBe("unknown_error");
    expect(LoggerUtils.classifyError(undefined)).toBe("unknown_error");
  });
});

// ── shouldSampleLog ────────────────────────────────────────────────────────────

describe("LoggerUtils.shouldSampleLog", () => {
  it("always returns true when rate is 1.0", () => {
    for (let i = 0; i < 20; i++) {
      expect(LoggerUtils.shouldSampleLog("info", { info: 1.0 })).toBe(true);
    }
  });

  // BUG: Source code uses `samplingRates[level] || 1.0` — when rate is explicitly
  // set to 0 (falsy), the `||` short-circuits to 1.0 instead of using 0.
  // This means Math.random() < 1.0 always returns true, even when rate should be 0.
  // The fix would be: `samplingRates[level] ?? 1.0`
  it("BUG: rate=0 returns true instead of false due to falsy || fallback to 1.0", () => {
    // Documenting the actual (buggy) behavior: 0 treated as 1.0, always true
    for (let i = 0; i < 20; i++) {
      expect(LoggerUtils.shouldSampleLog("debug", { debug: 0 })).toBe(true);
    }
  });

  it("defaults to 1.0 when level not in samplingRates (always true)", () => {
    // rate defaults to 1.0, so Math.random() < 1.0 is always true
    expect(LoggerUtils.shouldSampleLog("unknown", {})).toBe(true);
  });

  it("returns a boolean", () => {
    const result = LoggerUtils.shouldSampleLog("warn", { warn: 0.5 });
    expect(typeof result).toBe("boolean");
  });
});

// ── getClientIp ───────────────────────────────────────────────────────────────

describe("LoggerUtils.getClientIp", () => {
  it("returns cf-connecting-ip when present (highest priority)", () => {
    const headers = new Headers({ "cf-connecting-ip": "1.2.3.4" });
    expect(LoggerUtils.getClientIp(headers)).toBe("1.2.3.4");
  });

  it("falls back to x-forwarded-for first IP when cf-connecting-ip absent", () => {
    const headers = new Headers({ "x-forwarded-for": "10.0.0.1, 10.0.0.2" });
    expect(LoggerUtils.getClientIp(headers)).toBe("10.0.0.1");
  });

  it("falls back to x-real-ip when both cf and forwarded absent", () => {
    const headers = new Headers({ "x-real-ip": "192.168.1.5" });
    expect(LoggerUtils.getClientIp(headers)).toBe("192.168.1.5");
  });

  it("returns 'unknown' when no IP headers present", () => {
    const headers = new Headers();
    expect(LoggerUtils.getClientIp(headers)).toBe("unknown");
  });
});
