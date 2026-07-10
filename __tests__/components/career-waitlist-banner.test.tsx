/**
 * Tests for components/career-waitlist-banner.tsx (Task 5):
 * - hidden when the per-user dismissal key is present
 * - hidden when the hired banner is eligible AND not dismissed
 * - shown when the hired banner is eligible but the user has dismissed it
 * - renders otherwise
 * - dismiss (X) persists the key and fires career_banner_dismissed
 * - CTA fires career_banner_clicked and its href carries the UTM params
 */

// @jest-environment jsdom

import { render, screen, fireEvent } from "@testing-library/react";

// X / TrendingUp aren't in the global lucide mock; mock the icons used here.
jest.mock("lucide-react", () => ({
  X: () => <div data-testid="x-icon" />,
  TrendingUp: () => <div data-testid="trending-up-icon" />,
}));

jest.mock("@/lib/analytics/career-events", () => ({
  trackCareerBannerClicked: jest.fn(),
  trackCareerBannerDismissed: jest.fn(),
}));

import {
  trackCareerBannerClicked,
  trackCareerBannerDismissed,
} from "@/lib/analytics/career-events";
import { CAREER_CAMPAIGN } from "@/lib/constants/career";
import { CareerWaitlistBanner } from "@/components/career-waitlist-banner";

const mockClicked = trackCareerBannerClicked as jest.Mock;
const mockDismissed = trackCareerBannerDismissed as jest.Mock;

const USER_ID = "user-123";
const DISMISS_KEY = `career-waitlist-banner-dismissed:${USER_ID}`;
const HIRED_DISMISS_KEY = `hired-banner-dismissed:${USER_ID}`;
const TITLE = "Planning your next raise or promotion?";
const CTA_TEXT = "Join the waitlist";

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe("CareerWaitlistBanner", () => {
  it("renders the banner when not dismissed and not suppressed", () => {
    render(<CareerWaitlistBanner userId={USER_ID} />);
    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expect(screen.getByText(CTA_TEXT)).toBeInTheDocument();
  });

  it("does not render when the dismissal key is present", () => {
    localStorage.setItem(DISMISS_KEY, "true");
    const { container } = render(<CareerWaitlistBanner userId={USER_ID} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it("does not render while the hired banner is eligible and not dismissed", () => {
    const { container } = render(
      <CareerWaitlistBanner userId={USER_ID} hiredBannerEligible />
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it("renders when the hired banner is eligible but the user has dismissed it", () => {
    // Regression: hired+paid users were permanently excluded from this banner.
    localStorage.setItem(HIRED_DISMISS_KEY, "true");
    render(<CareerWaitlistBanner userId={USER_ID} hiredBannerEligible />);
    expect(screen.getByText(TITLE)).toBeInTheDocument();
  });

  it("persists the dismissal key and fires career_banner_dismissed on X", () => {
    render(<CareerWaitlistBanner userId={USER_ID} />);

    fireEvent.click(screen.getByLabelText("Dismiss banner"));

    expect(localStorage.getItem(DISMISS_KEY)).toBe("true");
    expect(mockDismissed).toHaveBeenCalledTimes(1);
    // Banner disappears after dismissal
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it("still renders and dismisses when localStorage throws (private mode)", () => {
    const getItem = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("denied", "SecurityError");
      });
    const setItem = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("denied", "SecurityError");
      });

    try {
      render(<CareerWaitlistBanner userId={USER_ID} />);
      // Read failure is treated as "not dismissed" — banner shows.
      expect(screen.getByText(TITLE)).toBeInTheDocument();

      // Write failure does not stop the session-level dismissal or the event.
      fireEvent.click(screen.getByLabelText("Dismiss banner"));
      expect(mockDismissed).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });

  it("fires career_banner_clicked and links to /career with the UTM params", () => {
    render(<CareerWaitlistBanner userId={USER_ID} />);

    const cta = screen.getByText(CTA_TEXT).closest("a");
    expect(cta).not.toBeNull();

    fireEvent.click(cta as HTMLAnchorElement);
    expect(mockClicked).toHaveBeenCalledTimes(1);

    const url = new URL(
      cta!.getAttribute("href") as string,
      "https://apptrack.ing"
    );
    expect(url.pathname).toBe("/career");
    expect(url.searchParams.get("utm_source")).toBe("in_app");
    expect(url.searchParams.get("utm_medium")).toBe("banner");
    expect(url.searchParams.get("utm_campaign")).toBe(CAREER_CAMPAIGN);
  });
});
