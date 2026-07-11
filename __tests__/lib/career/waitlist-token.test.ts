/**
 * Signed waitlist token: round-trips the email, and rejects any tampering so a
 * forged link can't register an email the sender doesn't control.
 */
import {
  generateWaitlistToken,
  verifyWaitlistToken,
} from "@/lib/career/waitlist-token";

describe("waitlist token", () => {
  it("round-trips the normalized email", () => {
    const token = generateWaitlistToken("  Jordan@Example.COM ");
    expect(verifyWaitlistToken(token)).toBe("jordan@example.com");
  });

  it("rejects a tampered signature", () => {
    const token = generateWaitlistToken("jordan@example.com");
    const [payload] = token.split(".");
    expect(verifyWaitlistToken(`${payload}.deadbeef`)).toBeNull();
  });

  it("rejects a swapped payload (can't forge another email)", () => {
    const token = generateWaitlistToken("jordan@example.com");
    const signature = token.split(".")[1];
    const forgedPayload = Buffer.from("victim@example.com").toString("base64url");
    expect(verifyWaitlistToken(`${forgedPayload}.${signature}`)).toBeNull();
  });

  it("rejects malformed / non-string input", () => {
    expect(verifyWaitlistToken("no-dot-here")).toBeNull();
    expect(verifyWaitlistToken("")).toBeNull();
    expect(verifyWaitlistToken(undefined)).toBeNull();
    expect(verifyWaitlistToken(12345)).toBeNull();
  });
});
