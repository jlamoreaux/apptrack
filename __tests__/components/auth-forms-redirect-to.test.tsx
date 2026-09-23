/**
 * The email sign-in and sign-up forms honor a validated redirectTo:
 * - sign-in: a valid redirectTo wins over the onboarding check (which isn't
 *   made); without one, a new user still goes to onboarding
 * - sign-up: redirectTo reaches signUpWithPassword (for the confirmation
 *   link), and with no confirmation needed the form goes there ahead of its
 *   onboarding, promo and preview destinations
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SignInForm } from "@/components/forms/sign-in-form";
import { SignUpForm } from "@/components/forms/sign-up-form";
import { signInWithPassword, signUpWithPassword } from "@/lib/actions";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(globalThis.location.search),
  usePathname: () => "/",
}));
jest.mock("@/lib/actions", () => ({
  signInWithPassword: jest.fn(),
  signUpWithPassword: jest.fn(),
}));
jest.mock("@/hooks/use-toast", () => ({ toast: jest.fn() }));
jest.mock("@/lib/analytics/linkedin", () => ({ trackLinkedInSignup: jest.fn() }));
jest.mock("@/lib/analytics/conversion-events", () => ({
  trackConversionEvent: jest.fn(),
  CONVERSION_EVENTS: { SIGNUP_COMPLETED: "signup_completed" },
}));

const mockSignIn = signInWithPassword as jest.Mock;
const mockSignUp = signUpWithPassword as jest.Mock;
const mockFetch = global.fetch as jest.Mock;

const CONSENT_PATH = "/oauth/consent?client_id=co_client_x&state=abc";
const PASSWORD = "Password1!";

function visit(path: string): void {
  window.history.pushState({}, "", path);
}

function fillSignIn(): void {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "me@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: PASSWORD } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
}

function fillSignUp(): void {
  fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Me" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "me@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: PASSWORD } });
  fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: PASSWORD } });
  fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ needsOnboarding: true }) });
  visit("/");
});

describe("SignInForm", () => {
  it("prefers a valid redirectTo over onboarding", async () => {
    visit(`/login?redirectTo=${encodeURIComponent(CONSENT_PATH)}`);
    mockSignIn.mockResolvedValue({ user: { id: "u1" } });
    render(<SignInForm />);
    fillSignIn();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(CONSENT_PATH));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sends a new user to onboarding without a redirectTo", async () => {
    mockSignIn.mockResolvedValue({ user: { id: "u1" } });
    render(<SignInForm />);
    fillSignIn();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/onboarding/welcome"));
  });

  it("ignores an absolute redirectTo", async () => {
    visit("/login?redirectTo=https%3A%2F%2Fevil.example%2F");
    mockSignIn.mockResolvedValue({ user: { id: "u1" } });
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ needsOnboarding: false }) });
    render(<SignInForm />);
    fillSignIn();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
  });
});

describe("SignUpForm", () => {
  it("passes redirectTo to sign-up and goes there when no confirmation is needed", async () => {
    visit("/signup?intent=layoff-offer");
    mockSignUp.mockResolvedValue({ success: true, user: { id: "u1" }, requiresEmailConfirmation: false });
    render(<SignUpForm redirectTo={CONSENT_PATH} />);
    fillSignUp();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(CONSENT_PATH));
    expect(mockSignUp).toHaveBeenCalledWith("me@example.com", PASSWORD, "Me", undefined, undefined, CONSENT_PATH);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("goes to the confirmation page when confirmation is needed", async () => {
    mockSignUp.mockResolvedValue({ success: true, user: { id: "u1" }, requiresEmailConfirmation: true });
    render(<SignUpForm redirectTo={CONSENT_PATH} />);
    fillSignUp();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/auth/confirm-email"));
  });

  it("keeps onboarding as the default without a redirectTo", async () => {
    mockSignUp.mockResolvedValue({ success: true, user: { id: "u1" }, requiresEmailConfirmation: false });
    render(<SignUpForm />);
    fillSignUp();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/onboarding/welcome"));
    expect(mockSignUp).toHaveBeenCalledWith("me@example.com", PASSWORD, "Me", undefined, undefined, undefined);
  });
});
