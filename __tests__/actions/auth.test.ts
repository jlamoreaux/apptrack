/**
 * Tests for auth server actions
 *
 * Key coverage: emailRedirectTo is passed to Supabase on signup so
 * confirmation emails land users on the welcome page, not the homepage, and
 * carries a validated redirectTo as the callback's `next` (anything that
 * isn't an internal path is dropped server-side).
 */

import { signUpWithPassword, signInWithPassword } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";

// Mock next/navigation (redirect throws in server actions)
jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

// Mock next/cache
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

const mockCreateClient = createClient as jest.Mock;

// Per-test auth mock — reassigned in beforeEach so each test gets a clean one
let mockSignUp: jest.Mock;
let mockSignIn: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.NEXT_PUBLIC_APP_URL;

  mockSignUp = jest.fn();
  mockSignIn = jest.fn();

  mockCreateClient.mockResolvedValue({
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignIn,
    },
  });
});

describe("signUpWithPassword", () => {
  it("passes emailRedirectTo pointing to welcome page", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "u1" }, session: null },
      error: null,
    });

    await signUpWithPassword("test@example.com", "Password1!", "Test User");

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining(
            "/auth/callback"
          ),
        }),
      })
    );
  });

  it("uses NEXT_PUBLIC_APP_URL when set", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://staging.careerotter.io";
    mockSignUp.mockResolvedValue({
      data: { user: { id: "u1" }, session: null },
      error: null,
    });

    await signUpWithPassword("test@example.com", "Password1!", "Test User");

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo:
            "https://staging.careerotter.io/auth/callback",
        }),
      })
    );
  });

  it("uses VERCEL_URL for preview deployments when NEXT_PUBLIC_APP_URL is not set", async () => {
    process.env.VERCEL_URL = "apptrack-git-my-branch-jlmx.vercel.app";
    mockSignUp.mockResolvedValue({
      data: { user: { id: "u1" }, session: null },
      error: null,
    });

    await signUpWithPassword("test@example.com", "Password1!", "Test User");

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo:
            "https://apptrack-git-my-branch-jlmx.vercel.app/auth/callback",
        }),
      })
    );

    delete process.env.VERCEL_URL;
  });

  it("falls back to careerotter.io when no env vars are set", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "u1" }, session: null },
      error: null,
    });

    await signUpWithPassword("test@example.com", "Password1!", "Test User");

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo:
            "https://careerotter.io/auth/callback",
        }),
      })
    );
  });

  it("returns requiresEmailConfirmation true when no session returned", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "u1" }, session: null },
      error: null,
    });

    const result = await signUpWithPassword(
      "test@example.com",
      "Password1!",
      "Test User"
    );

    expect(result).toMatchObject({ success: true, requiresEmailConfirmation: true });
  });

  it("returns requiresEmailConfirmation false when session is returned", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "u1" }, session: { access_token: "tok" } },
      error: null,
    });

    const result = await signUpWithPassword(
      "test@example.com",
      "Password1!",
      "Test User"
    );

    expect(result).toMatchObject({ success: true, requiresEmailConfirmation: false });
  });

  it("returns error when Supabase signup fails", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "User already registered" },
    });

    const result = await signUpWithPassword(
      "existing@example.com",
      "Password1!",
      "Test User"
    );

    expect(result).toEqual({ error: "User already registered" });
  });

  it("includes traffic_source in user metadata when provided", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "u1" }, session: null },
      error: null,
    });

    await signUpWithPassword("test@example.com", "Password1!", "Test User", {
      source: "linkedin",
    } as any);

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: expect.objectContaining({
            traffic_source: { source: "linkedin" },
          }),
        }),
      })
    );
  });
});

describe("signUpWithPassword redirectTo", () => {
  const CONSENT_PATH = "/oauth/consent?client_id=co_client_x&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb";

  function emailRedirectTo(): string {
    return mockSignUp.mock.calls[0][0].options.emailRedirectTo;
  }

  beforeEach(() => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "u1" }, session: null }, error: null });
  });

  it("carries a valid redirectTo as the callback's next", async () => {
    await signUpWithPassword("test@example.com", "Password1!", "Test User", undefined, undefined, CONSENT_PATH);
    expect(emailRedirectTo()).toBe(
      `https://careerotter.io/auth/callback?next=${encodeURIComponent(CONSENT_PATH)}`
    );
    expect(new URL(emailRedirectTo()).searchParams.get("next")).toBe(CONSENT_PATH);
  });

  it.each(["https://evil.example/", "//evil.example/", "/\\evil.example", "javascript:alert(1)"])(
    "drops %s",
    async (redirectTo) => {
      await signUpWithPassword("test@example.com", "Password1!", "Test User", undefined, undefined, redirectTo);
      expect(emailRedirectTo()).toBe("https://careerotter.io/auth/callback");
    }
  );
});

describe("signInWithPassword", () => {
  it("returns success on valid credentials", async () => {
    const mockUser = { id: "u1", email: "test@example.com" };
    mockSignIn.mockResolvedValue({
      data: { user: mockUser, session: { access_token: "tok" } },
      error: null,
    });

    const result = await signInWithPassword("test@example.com", "Password1!");

    expect(result).toMatchObject({ success: true, user: mockUser });
  });

  it("returns error on invalid credentials", async () => {
    mockSignIn.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    const result = await signInWithPassword("test@example.com", "wrongpass");

    expect(result).toEqual({ error: "Invalid login credentials" });
  });
});
