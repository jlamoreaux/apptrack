/**
 * Tests for the /career waitlist join form (Task 4):
 * - renders + prefills email from userEmail
 * - review-timing dropdown options come from REVIEW_TIMING_OPTIONS
 * - successful submit posts the right contract + shows the confirmation state
 * - 400 / 429 / network errors are surfaced inline (no silent failures)
 * - career_waitlist_viewed fires on mount with the derived source
 * - career_email_clicked fires only when utm_campaign matches CAREER_CAMPAIGN
 */

import type { ReactNode } from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { CareerWaitlistForm } from "@/app/(marketing)/career/career-waitlist-form";
import {
  REVIEW_TIMING_OPTIONS,
  CAREER_CAMPAIGN,
} from "@/lib/constants/career";

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

// --- Radix Select -> testable lightweight equivalent ----------------------
// Captures onValueChange so a test can pick a value, and renders each option's
// label so option assertions work without driving Radix pointer events.
let selectOnValueChange: ((value: string) => void) | undefined;
jest.mock("@/components/ui/select", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Select: ({
      children,
      onValueChange,
    }: {
      children?: ReactNode;
      onValueChange?: (value: string) => void;
    }) => {
      selectOnValueChange = onValueChange;
      return <div>{children}</div>;
    },
    SelectTrigger: Passthrough,
    SelectValue: ({ placeholder }: { placeholder?: string }) => (
      <span>{placeholder}</span>
    ),
    SelectContent: Passthrough,
    SelectItem: ({ children, value }: { children?: ReactNode; value?: string }) => (
      <div data-value={value}>{children}</div>
    ),
  };
});

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function selectFirstTiming() {
  act(() => {
    selectOnValueChange?.(REVIEW_TIMING_OPTIONS[0].value);
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /join the waitlist/i }));
}

describe("CareerWaitlistForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    mockSearchParams = new URLSearchParams();
    selectOnValueChange = undefined;
  });

  it("prefills the email input from userEmail", () => {
    render(<CareerWaitlistForm userEmail="user@example.com" />);
    expect(screen.getByLabelText("Email")).toHaveValue("user@example.com");
  });

  it("renders an empty email input when userEmail is null", () => {
    render(<CareerWaitlistForm userEmail={null} />);
    expect(screen.getByLabelText("Email")).toHaveValue("");
  });

  it("renders every review-timing option from the constants", () => {
    render(<CareerWaitlistForm userEmail={null} />);
    for (const option of REVIEW_TIMING_OPTIONS) {
      expect(screen.getByText(option.label)).toBeInTheDocument();
    }
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

  it("requires a review-timing selection before submitting", async () => {
    render(<CareerWaitlistForm userEmail="user@example.com" />);
    submit();
    await waitFor(() => {
      expect(
        screen.getByText("Please select when your next review is")
      ).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("posts the expected contract and shows the confirmation on success", async () => {
    mockSearchParams = new URLSearchParams({ utm_medium: "email" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    render(<CareerWaitlistForm userEmail="user@example.com" />);
    selectFirstTiming();
    submit();

    await waitFor(() => {
      expect(screen.getByText("You're on the list.")).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/career-waitlist",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toMatchObject({
      email: "user@example.com",
      review_timing: REVIEW_TIMING_OPTIONS[0].value,
      source: "email",
      utm: { utm_source: "email" },
      ph_distinct_id: "ph_abc",
    });
  });

  it("surfaces the server 400 message inline", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Please use a permanent email address" }),
    });

    render(<CareerWaitlistForm userEmail="user@example.com" />);
    selectFirstTiming();
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
    selectFirstTiming();
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
    selectFirstTiming();
    submit();

    await waitFor(() => {
      expect(
        screen.getByText("Something went wrong. Please try again.")
      ).toBeInTheDocument();
    });
  });
});
