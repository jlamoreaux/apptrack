/**
 * The login and signup pages carry a validated redirectTo (e.g. an app
 * connection's consent page) through sign-in and sign-up:
 * - login: passed to the Google button, and carried by the "Sign up" link
 * - signup: passed to the Google button (ahead of the offer destinations)
 *   and to the email form, and carried by the "Sign in" link
 * - an absolute or protocol-relative redirectTo is dropped
 */

import { fireEvent, render, screen } from "@testing-library/react";
import LoginPage from "@/app/(marketing)/login/page";
import SignUpPageClient from "@/app/(marketing)/signup/signup-page-client";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";
import { SignUpForm } from "@/components/forms/sign-up-form";

let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/",
}));
jest.mock("@/components/auth/google-signin-button", () => ({
  GoogleSignInButton: jest.fn(() => null),
}));
jest.mock("@/components/forms/sign-in-form", () => ({ SignInForm: () => null }));
jest.mock("@/components/forms/sign-up-form", () => ({ SignUpForm: jest.fn(() => null) }));
jest.mock("@/lib/hooks/use-utm-tracking", () => ({ useUTMTracking: jest.fn() }));
jest.mock("@/lib/analytics/campaign-events", () => ({ trackCampaignSignupIntent: jest.fn() }));

const mockGoogleButton = GoogleSignInButton as unknown as jest.Mock;
const mockSignUpForm = SignUpForm as unknown as jest.Mock;

const CONSENT_PATH = "/oauth/consent?client_id=co_client_x&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb";

function lastProps(mock: jest.Mock): Record<string, unknown> {
  return mock.mock.calls[mock.mock.calls.length - 1][0];
}

async function renderLogin(params: Record<string, string>): Promise<void> {
  render(await LoginPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams();
});

describe("login page", () => {
  it("passes a valid redirectTo to the Google button and the sign-up link", async () => {
    await renderLogin({ redirectTo: CONSENT_PATH });
    expect(lastProps(mockGoogleButton)).toMatchObject({ context: "signin", redirectTo: CONSENT_PATH });
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      `/signup?redirectTo=${encodeURIComponent(CONSENT_PATH)}`
    );
  });

  it.each(["https://evil.example/", "//evil.example/", "/x?u=https://evil.example"])(
    "drops %s",
    async (redirectTo) => {
      await renderLogin({ redirectTo });
      expect(lastProps(mockGoogleButton).redirectTo).toBeUndefined();
      expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup");
    }
  );
});

describe("signup page", () => {
  it("passes a valid redirectTo to the Google button, the email form and the sign-in link", () => {
    mockSearchParams = new URLSearchParams({ redirectTo: CONSENT_PATH, intent: "trial" });
    render(<SignUpPageClient />);
    expect(lastProps(mockGoogleButton)).toMatchObject({ context: "signup", redirectTo: CONSENT_PATH });
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      `/login?redirectTo=${encodeURIComponent(CONSENT_PATH)}`
    );

    fireEvent.click(screen.getByRole("button", { name: /continue with email/i }));
    expect(lastProps(mockSignUpForm)).toEqual({ redirectTo: CONSENT_PATH });
  });

  it("keeps the offer destination without a redirectTo", () => {
    mockSearchParams = new URLSearchParams({ intent: "trial" });
    render(<SignUpPageClient />);
    expect(lastProps(mockGoogleButton).redirectTo).toBe("/onboarding/welcome?promo=REDDIT7");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("drops an absolute redirectTo", () => {
    mockSearchParams = new URLSearchParams({ redirectTo: "https://evil.example/" });
    render(<SignUpPageClient />);
    expect(lastProps(mockGoogleButton).redirectTo).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: /continue with email/i }));
    expect(lastProps(mockSignUpForm)).toEqual({ redirectTo: null });
  });
});
