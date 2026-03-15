import {
  formatLocalDate,
  formatLocalDateTime,
  formatLocalTime,
  parseDateAsLocal,
  formatDateAsLocal,
  toISOString,
  getStartOfToday,
  getEndOfToday,
  daysBetween,
  isInPast,
  isInFuture,
  addDays,
  subtractDays,
} from "@/lib/utils/date";

describe("date utilities", () => {
  describe("parseDateAsLocal", () => {
    it("parses YYYY-MM-DD as local midnight, not UTC", () => {
      const date = parseDateAsLocal("2024-03-14");
      expect(date).not.toBeNull();
      expect(date!.getFullYear()).toBe(2024);
      expect(date!.getMonth()).toBe(2); // March = 2
      expect(date!.getDate()).toBe(14);
      // Should be local midnight, not UTC midnight
      expect(date!.getHours()).toBe(0);
      expect(date!.getMinutes()).toBe(0);
    });

    it("returns null for null/undefined/empty input", () => {
      expect(parseDateAsLocal(null)).toBeNull();
      expect(parseDateAsLocal(undefined)).toBeNull();
      expect(parseDateAsLocal("")).toBeNull();
    });

    it("returns null for non-date strings", () => {
      expect(parseDateAsLocal("not-a-date")).toBeNull();
      expect(parseDateAsLocal("2024-13-01")).toBeNull();
      expect(parseDateAsLocal("2024-02-31")).toBeNull();
      expect(parseDateAsLocal("abc-de-fg")).toBeNull();
    });

    it("returns null for partial date strings", () => {
      expect(parseDateAsLocal("2024-03")).toBeNull();
      expect(parseDateAsLocal("2024")).toBeNull();
    });
  });

  describe("formatLocalDate", () => {
    it("formats a YYYY-MM-DD string correctly without UTC shift", () => {
      const result = formatLocalDate("2024-03-14");
      // Should contain "Mar" and "14" and "2024" regardless of timezone
      expect(result).toContain("14");
      expect(result).toContain("2024");
    });

    it("returns 'Not specified' for null/undefined", () => {
      expect(formatLocalDate(null)).toBe("Not specified");
      expect(formatLocalDate(undefined)).toBe("Not specified");
    });

    it("returns 'Invalid date' for invalid input", () => {
      expect(formatLocalDate("not-a-date")).toBe("Invalid date");
    });

    it("formats a Date object", () => {
      const date = new Date(2024, 2, 14); // March 14, 2024 local
      const result = formatLocalDate(date);
      expect(result).toContain("14");
      expect(result).toContain("2024");
    });

    it("accepts custom Intl options", () => {
      const result = formatLocalDate("2024-03-14", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      expect(result).toContain("2024");
    });
  });

  describe("formatLocalDateTime", () => {
    it("returns 'Not specified' for null", () => {
      expect(formatLocalDateTime(null)).toBe("Not specified");
    });

    it("returns 'Invalid date' for invalid input", () => {
      expect(formatLocalDateTime("garbage")).toBe("Invalid date");
    });

    it("formats a valid ISO string with time", () => {
      const result = formatLocalDateTime("2024-03-14T10:30:00Z");
      expect(result).toContain("2024");
    });
  });

  describe("formatLocalTime", () => {
    it("returns 'Not specified' for null", () => {
      expect(formatLocalTime(null)).toBe("Not specified");
    });

    it("returns 'Invalid date' for invalid input", () => {
      expect(formatLocalTime("garbage")).toBe("Invalid date");
    });
  });

  describe("formatDateAsLocal", () => {
    it("formats a Date to YYYY-MM-DD in local timezone", () => {
      const date = new Date(2024, 2, 14); // March 14
      expect(formatDateAsLocal(date)).toBe("2024-03-14");
    });

    it("pads month and day with leading zeros", () => {
      const date = new Date(2024, 0, 5); // January 5
      expect(formatDateAsLocal(date)).toBe("2024-01-05");
    });

    it("returns empty string for null/undefined", () => {
      expect(formatDateAsLocal(null)).toBe("");
      expect(formatDateAsLocal(undefined)).toBe("");
    });
  });

  describe("toISOString", () => {
    it("preserves timestamp for full ISO datetime strings", () => {
      const input = "2024-03-14T10:30:00.000Z";
      expect(toISOString(input)).toBe(input);
    });

    it("converts a YYYY-MM-DD string to ISO format", () => {
      const result = toISOString("2024-03-14");
      expect(result).not.toBeNull();
      expect(result).toContain("2024-03-14");
    });

    it("converts a Date object to ISO format", () => {
      const date = new Date(2024, 2, 14, 12, 0, 0);
      const result = toISOString(date);
      expect(result).not.toBeNull();
      expect(result).toContain("2024");
    });

    it("returns null for null/undefined", () => {
      expect(toISOString(null)).toBeNull();
      expect(toISOString(undefined)).toBeNull();
    });

    it("returns null for invalid date string", () => {
      expect(toISOString("not-a-date")).toBeNull();
    });
  });

  describe("getStartOfToday", () => {
    it("returns midnight of today in local timezone", () => {
      const start = getStartOfToday();
      const now = new Date();
      expect(start.getFullYear()).toBe(now.getFullYear());
      expect(start.getMonth()).toBe(now.getMonth());
      expect(start.getDate()).toBe(now.getDate());
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
    });
  });

  describe("getEndOfToday", () => {
    it("returns 23:59:59.999 of today in local timezone", () => {
      const end = getEndOfToday();
      const now = new Date();
      expect(end.getFullYear()).toBe(now.getFullYear());
      expect(end.getMonth()).toBe(now.getMonth());
      expect(end.getDate()).toBe(now.getDate());
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
      expect(end.getMilliseconds()).toBe(999);
    });
  });

  describe("daysBetween", () => {
    it("calculates exact whole days correctly", () => {
      const from = new Date(2024, 2, 10); // March 10
      const to = new Date(2024, 2, 14); // March 14
      expect(daysBetween(from, to)).toBe(4);
    });

    it("handles string dates", () => {
      expect(daysBetween("2024-03-10", "2024-03-14")).toBe(4);
    });

    it("returns 0 for same date", () => {
      const date = new Date(2024, 2, 14);
      expect(daysBetween(date, date)).toBe(0);
    });

    it("normalizes to day start so time-of-day does not affect count", () => {
      // 3 days apart regardless of time
      const from = new Date(2024, 2, 10, 23, 59, 59);
      const to = new Date(2024, 2, 13, 1, 0, 0);
      expect(daysBetween(from, to)).toBe(3);
    });

    it("is absolute (order does not matter)", () => {
      expect(daysBetween("2024-03-14", "2024-03-10")).toBe(4);
    });
  });

  describe("isInPast", () => {
    it("returns true for a date well in the past", () => {
      expect(isInPast("2020-01-01")).toBe(true);
    });

    it("returns false for a date in the future", () => {
      expect(isInPast("2099-01-01")).toBe(false);
    });
  });

  describe("isInFuture", () => {
    it("returns true for a date in the future", () => {
      expect(isInFuture("2099-01-01")).toBe(true);
    });

    it("returns false for a date in the past", () => {
      expect(isInFuture("2020-01-01")).toBe(false);
    });
  });

  describe("addDays", () => {
    it("adds days to a Date", () => {
      const result = addDays(new Date(2024, 2, 14), 5);
      expect(result.getDate()).toBe(19);
      expect(result.getMonth()).toBe(2);
    });

    it("adds days to a date string", () => {
      const result = addDays("2024-03-14", 5);
      expect(result.getDate()).toBe(19);
    });

    it("handles month rollover", () => {
      const result = addDays(new Date(2024, 2, 30), 5);
      expect(result.getMonth()).toBe(3); // April
      expect(result.getDate()).toBe(4);
    });
  });

  describe("subtractDays", () => {
    it("subtracts days from a Date", () => {
      const result = subtractDays(new Date(2024, 2, 14), 5);
      expect(result.getDate()).toBe(9);
    });

    it("handles month rollback", () => {
      const result = subtractDays(new Date(2024, 2, 3), 5);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(27);
    });
  });

  describe("timezone safety: YYYY-MM-DD never shifts day", () => {
    it("formatLocalDate('2024-03-14') always shows day 14", () => {
      const result = formatLocalDate("2024-03-14");
      expect(result).toContain("14");
    });

    it("parseDateAsLocal round-trips through formatDateAsLocal", () => {
      const original = "2024-03-14";
      const parsed = parseDateAsLocal(original);
      expect(parsed).not.toBeNull();
      const formatted = formatDateAsLocal(parsed!);
      expect(formatted).toBe(original);
    });
  });
});
