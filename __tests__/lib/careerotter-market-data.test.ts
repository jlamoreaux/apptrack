// @jest-environment node
import {
  lookupMarketRange,
  compDelta,
  COMP_ROLE_FAMILIES,
  COMP_LEVELS,
} from "@/lib/careerotter/market-data";

describe("lookupMarketRange", () => {
  it("returns a sourced range for a known role/level", () => {
    const r = lookupMarketRange("software_engineer", "senior");
    expect(r).not.toBeNull();
    expect(r!.low).toBeLessThan(r!.mid);
    expect(r!.mid).toBeLessThan(r!.high);
    expect(r!.source).toMatch(/BLS/);
  });

  it("returns null for an unknown role/level (no fabricated ranges)", () => {
    expect(lookupMarketRange("astronaut", "senior")).toBeNull();
    expect(lookupMarketRange("software_engineer", "principal")).toBeNull();
    expect(lookupMarketRange(null, null)).toBeNull();
  });

  it("only lists role families / levels that resolve to data", () => {
    // Every advertised family has at least one level with data.
    for (const f of COMP_ROLE_FAMILIES) {
      const anyLevel = COMP_LEVELS.some((l) => lookupMarketRange(f.value, l.value));
      expect(anyLevel).toBe(true);
    }
  });
});

describe("compDelta", () => {
  const range = lookupMarketRange("software_engineer", "senior")!;

  it("reports under market as a negative pct", () => {
    const d = compDelta(range.mid * 0.89, range);
    expect(d.pct).toBeLessThan(0);
    expect(d.direction).toBe("under");
  });

  it("reports over market as positive", () => {
    const d = compDelta(range.mid * 1.2, range);
    expect(d.pct).toBeGreaterThan(0);
    expect(d.direction).toBe("over");
  });

  it("reports at market near the midpoint", () => {
    expect(compDelta(range.mid, range).direction).toBe("at");
  });
});
