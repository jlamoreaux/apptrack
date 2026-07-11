/**
 * Tests for the /career waitlist join form:
 * - renders + prefills email from userEmail
 * - manual submit posts the right contract (email + source + utm) and shows the
 *   confirmation; no review-timing question anymore
 * - 400 / 429 / network errors are surfaced inline (no silent failures)
 * - career_waitlist_viewed / career_email_clicked fire per the derived source
 * - a signed token in the URL auto-joins (one click), falling back to the form
 *   if the token is rejected
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CareerWaitlistForm } from "@/app/(marketing)/career/career-waitlist-form";
import { CAREER_CAMPAIGN } from "@/lib/constants/career";

// --- next/navigation: per-test searchParams -------------------------------
let mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

// --- analytics module -----------------------------------------------------
const mockTrackViewed = jest.fn();
const mockTrackEmailClicked = jest.fn();
jest.mock("@/lib/analytics/career-events", () => ({
  trackCareerWaitlistViewed: (...args: unknown[]) => mockTrackViewed(...args),
  trackCareerEmailClicked: (...args: unknown[]) => mockTrackEmailClicked(...args),
}));

// --- UTM hook -------------------------------------------------------------
jest.mock("@/lib/hooks/use-utm-tracking", () => ({
  useUTMTracking: () => ({ getUTMParams: () => ({}), buildURLWithUTM: (u: string) => u }),
  getStoredUTMParams: () => ({ utm_source: "email" }),
}));

// --- posthog-js distinct id ----------------------------------------------
jest.mock(
  "posthog-js",
  () => ({ __esModule: true, default: { get_distinct_id: () => "ph_abc" } }),
  { virtual: true }
);

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /join the waitlist/i }));
}

describe("CareerWaitlistForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    mockSearchParams = new URLSearchParams();
  });

  it("prefills the email input from userEmail", () => {
    render(<CareerWaitlistForm userEmail="user@example.com" />);
    expect(screen.getByLabelText("Email")).toHaveValue("user@example.com");
  });

  it("renders an empty email input when userEmail is null", () => {
    render(<CareerWaitlistForm userEmail={null} />);
    expect(screen.getByLabelText("Email")).toHaveValue("");
  });

  it("no longer shows a review-timing question", () => {
    render(<CareerWaitlistForm userEmail={null} />);
    expect(
      screen.queryByText(/next performance review/i)
    ).not.toBeInTheDocument();
  });

  it("fires career_waitlist_viewed on mount with derived source 'direct'", () => {
    render(<CareerWaitlistForm userEmail={null} />);
    expect(mockTrackViewed).toHaveBeenCalledWith({ source: "direct" });
  });

  it("derives source 'banner' from utm_medium=banner", () => {
    mockSearchParams = new URLSearchParams({ utm_medium: "banner" });
    render(<CareerWaitlistForm userEmail={null} />);
    expect(mockTrackViewed).toHaveBeenCalledWith({ source: "banner" });
  });

  it("derives source 'email' from utm_medium=email", () => {
    mockSearchParams = new URLSearchParams({ utm_medium: "email" });
    render(<CareerWaitlistForm userEmail={null} />);
    expect(mockTrackViewed).toHaveBeenCalledWith({ source: "email" });
  });

  it("does not fire career_email_clicked without a matching utm_campaign", () => {
    render(<CareerWaitlistForm userEmail={null} />);
    expect(mockTrackEmailClicked).not.toHaveBeenCalled();
  });

  it("fires career_email_clicked when utm_campaign matches CAREER_CAMPAIGN", () => {
    mockSearchParams = new URLSearchParams({ utm_campaign: CAREER_CAMPAIGN });
    render(<CareerWaitlistForm userEmail={null} />);
    expect(mockTrackEmailClicked).toHaveBeenCalledTimes(1);
  });

  it("shows an inline error for an invalid email and does not call the API", async () => {
    render(<CareerWaitlistForm userEmail={null} />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "notanemail" },
    });
    submit();
    await waitFor(() => {
      expect(
        screen.getByText("Please enter a valid email address")
      ).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("posts email + source + utm (no review_timing) and shows the confirmation", async () => {
    mockSearchParams = new URLSearchParams({ utm_medium: "email" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    render(<CareerWaitlistForm userEmail="user@example.com" />);
    submit();

    await waitFor(() => {
      expect(screen.getByText("You're on the list.")).toBeInTheDocument();
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toMatchObject({
      email: "user@example.com",
      source: "email",
      utm: { utm_source: "email" },
      ph_distinct_id: "ph_abc",
    });
    expect(body).not.toHaveProperty("review_timing");
  });

  it("surfaces the server 400 message inline", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Please use a permanent email address" }),
    });

    render(<CareerWaitlistForm userEmail="user@example.com" />);
    submit();

    await waitFor(() => {
      expect(
        screen.getByText("Please use a permanent email address")
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("You're on the list.")).not.toBeInTheDocument();
  });

  it("surfaces the friendly 429 message inline", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "Too many attempts. Please try again in an hour." }),
    });

    render(<CareerWaitlistForm userEmail="user@example.com" />);
    submit();

    await waitFor(() => {
      expect(
        screen.getByText("Too many attempts. Please try again in an hour.")
      ).toBeInTheDocument();
    });
  });

  it("shows a generic retryable error on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));

    render(<CareerWaitlistForm userEmail="user@example.com" />);
    submit();

    await waitFor(() => {
      expect(
        screen.getByText("Something went wrong. Please try again.")
      ).toBeInTheDocument();
    });
  });

  describe("one-click token (t param)", () => {
    it("auto-joins with the token and shows the confirmation, no form", async () => {
      mockSearchParams = new URLSearchParams({ t: "signed.token", utm_medium: "email" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      render(<CareerWaitlistForm userEmail={null} />);

      await waitFor(() => {
        expect(screen.getByText("You're on the list.")).toBeInTheDocument();
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toMatchObject({ token: "signed.token", source: "email" });
      expect(body).not.toHaveProperty("email");
      // The manual form never rendered.
      expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    });

    it("falls back to the manual form when the token is rejected", async () => {
      mockSearchParams = new URLSearchParams({ t: "bad.token" });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "Invalid or expired link." }),
      });

      render(<CareerWaitlistForm userEmail={null} />);

      await waitFor(() => {
        expect(screen.getByLabelText("Email")).toBeInTheDocument();
      });
      expect(screen.queryByText("You're on the list.")).not.toBeInTheDocument();
    });
  });
});
