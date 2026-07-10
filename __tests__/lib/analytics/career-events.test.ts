/**
 * Tests for Career Companion analytics events (Task 2)
 * Verifies event names, UTM merge behavior, and the per-session
 * de-dupe of career_email_clicked.
 */

import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { getStoredUTMParams } from "@/lib/hooks/use-utm-tracking";
import {
  CAREER_EVENTS,
  trackCareerWaitlistViewed,
  trackCareerEmailClicked,
  trackCareerBannerClicked,
  trackCareerBannerDismissed,
} from "@/lib/analytics/career-events";

jest.mock("@/lib/analytics/posthog", () => ({
  capturePostHogEvent: jest.fn(),
}));

jest.mock("@/lib/hooks/use-utm-tracking", () => ({
  getStoredUTMParams: jest.fn(() => ({})),
}));

const mockCapture = capturePostHogEvent as jest.MockedFunction<
  typeof capturePostHogEvent
>;
const mockGetStoredUTMParams = getStoredUTMParams as jest.MockedFunction<
  typeof getStoredUTMParams
>;

const STORED_UTM = {
  utm_source: "in_app",
  utm_medium: "banner",
  utm_campaign: "career_companion_validation",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetStoredUTMParams.mockReturnValue({});
  sessionStorage.clear();
});

describe("CAREER_EVENTS registry", () => {
  it("uses the snake_case names the PostHog dashboard expects", () => {
    expect(CAREER_EVENTS.WAITLIST_VIEWED).toBe("career_waitlist_viewed");
    expect(CAREER_EVENTS.EMAIL_CLICKED).toBe("career_email_clicked");
    expect(CAREER_EVENTS.BANNER_CLICKED).toBe("career_banner_clicked");
    expect(CAREER_EVENTS.BANNER_DISMISSED).toBe("career_banner_dismissed");
    // Server-fired names kept in the registry as the single source of truth
    expect(CAREER_EVENTS.EMAIL_SENT).toBe("career_email_sent");
    expect(CAREER_EVENTS.WAITLIST_JOINED).toBe("career_waitlist_joined");
  });
});

describe("trackCareerWaitlistViewed", () => {
  it("captures career_waitlist_viewed with the source property", () => {
    trackCareerWaitlistViewed({ source: "banner" });

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith("career_waitlist_viewed", {
      source: "banner",
    });
  });

  it("merges stored UTM params into event properties", () => {
    mockGetStoredUTMParams.mockReturnValue(STORED_UTM);

    trackCareerWaitlistViewed({ source: "email" });

    expect(mockCapture).toHaveBeenCalledWith("career_waitlist_viewed", {
      source: "email",
      ...STORED_UTM,
    });
  });
});

describe("trackCareerBannerClicked / trackCareerBannerDismissed", () => {
  it("captures career_banner_clicked with stored UTM params", () => {
    mockGetStoredUTMParams.mockReturnValue(STORED_UTM);

    trackCareerBannerClicked();

    expect(mockCapture).toHaveBeenCalledWith(
      "career_banner_clicked",
      STORED_UTM
    );
  });

  it("captures career_banner_dismissed with stored UTM params", () => {
    mockGetStoredUTMParams.mockReturnValue(STORED_UTM);

    trackCareerBannerDismissed();

    expect(mockCapture).toHaveBeenCalledWith(
      "career_banner_dismissed",
      STORED_UTM
    );
  });
});

describe("trackCareerEmailClicked", () => {
  it("captures career_email_clicked with stored UTM params on first call", () => {
    mockGetStoredUTMParams.mockReturnValue(STORED_UTM);

    trackCareerEmailClicked();

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith(
      "career_email_clicked",
      STORED_UTM
    );
  });

  it("fires at most once per browser session", () => {
    trackCareerEmailClicked();
    trackCareerEmailClicked();
    trackCareerEmailClicked();

    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it("fires again in a new session (sessionStorage cleared)", () => {
    trackCareerEmailClicked();
    expect(mockCapture).toHaveBeenCalledTimes(1);

    // Simulate a new browser session
    sessionStorage.clear();

    trackCareerEmailClicked();
    expect(mockCapture).toHaveBeenCalledTimes(2);
  });

  it("still fires when sessionStorage is unavailable", () => {
    const getItemSpy = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("sessionStorage disabled");
      });

    try {
      trackCareerEmailClicked();
      expect(mockCapture).toHaveBeenCalledTimes(1);
      expect(mockCapture).toHaveBeenCalledWith("career_email_clicked", {});
    } finally {
      getItemSpy.mockRestore();
    }
  });
});
