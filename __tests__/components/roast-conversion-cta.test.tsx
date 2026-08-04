/**
 * Tests for the roast results-page conversion repair (Task 8):
 * - creator variant renders the after-score conversion module + both signup CTAs
 * - visitor variant keeps its existing CTA behavior
 * - roast_signup_clicked fires with the correct `placement` per CTA
 * - signup CTA navigation targets carry the roast-funnel UTM params
 */

import { render, screen, fireEvent } from "@testing-library/react";
import RoastDisplayV1 from "@/app/(marketing)/roast/[id]/roast-display";
import RoastDisplayV2 from "@/app/(marketing)/roast/v2/[id]/roast-display";
import {
  RoastConversionModule,
  ROAST_SIGNUP_URL,
  ROAST_VISITOR_SIGNUP_URL,
} from "@/components/roast/roast-conversion-cta";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockTrackEvent = jest.fn();
jest.mock("@/lib/roast/analytics", () => ({
  ...jest.requireActual("@/lib/roast/analytics"),
  useRoastAnalytics: () => ({ trackEvent: mockTrackEvent }),
}));

jest.mock("posthog-js/react", () => ({
  usePostHog: () => null,
}));

// The global lucide-react mock in jest.setup.js only covers a fixed icon list;
// the roast displays use additional icons, so mock the full set used here.
jest.mock("lucide-react", () => ({
  Flame: () => <div data-testid="flame-icon" />,
  Copy: () => <div data-testid="copy-icon" />,
  Twitter: () => <div data-testid="twitter-icon" />,
  TrendingUp: () => <div data-testid="trending-up-icon" />,
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
  X: () => <div data-testid="x-icon" />,
  Share2: () => <div data-testid="share2-icon" />,
  Check: () => <div data-testid="check-icon" />,
}));

const roastId = "roast_123";

const roast = {
  content: "Paragraph one.\n\nParagraph two.",
  emojiScore: "🔥🔥🔥",
  scoreLabel: "Dumpster Fire",
  tagline: "A roast tagline",
  firstName: "Alex",
  categories: {
    buzzwordBingo: true,
    lengthCrimes: false,
    formattingDisasters: false,
    skillsInflation: false,
    genericDisease: false,
    industryMisalignment: false,
  },
  createdAt: "2026-07-01T00:00:00.000Z",
  viewCount: 3,
};

const BENEFIT_BULLETS = [
  "Save this roast to your account",
  "Track your applications in one place",
  "Get targeted improvement tips",
];

describe("ROAST_SIGNUP_URL", () => {
  it("targets /signup and carries the roast-funnel UTM params", () => {
    const url = new URL(ROAST_SIGNUP_URL, "https://careerotter.io");
    expect(url.pathname).toBe("/signup");
    expect(url.searchParams.get("utm_source")).toBe("roast");
    expect(url.searchParams.get("utm_medium")).toBe("results_page");
    expect(url.searchParams.get("utm_campaign")).toBe("roast_funnel");
  });
});

describe("ROAST_VISITOR_SIGNUP_URL", () => {
  it("uses a distinct visitor_view medium so it doesn't conflate with the creator funnel", () => {
    const url = new URL(ROAST_VISITOR_SIGNUP_URL, "https://careerotter.io");
    expect(url.pathname).toBe("/signup");
    expect(url.searchParams.get("utm_source")).toBe("roast");
    expect(url.searchParams.get("utm_medium")).toBe("visitor_view");
    expect(url.searchParams.get("utm_campaign")).toBe("roast_funnel");
  });
});

describe("RoastConversionModule", () => {
  it("renders the heading, benefit bullets, and primary CTA", () => {
    render(<RoastConversionModule roastId={roastId} />);

    expect(screen.getByText("Make This Roast Count")).toBeInTheDocument();
    BENEFIT_BULLETS.forEach((bullet) => {
      expect(screen.getByText(bullet)).toBeInTheDocument();
    });
    expect(screen.getByText("Sign up free")).toBeInTheDocument();
  });

  it("fires roast_signup_clicked with placement after_score and navigates with UTMs", () => {
    render(<RoastConversionModule roastId={roastId} />);

    fireEvent.click(screen.getByText("Sign up free"));

    expect(mockTrackEvent).toHaveBeenCalledWith("roast_signup_clicked", {
      roastId,
      source: "results_page",
      placement: "after_score",
    });
    expect(mockPush).toHaveBeenCalledWith(ROAST_SIGNUP_URL);
  });
});

describe.each([
  ["v1", RoastDisplayV1, "Sign Up for Free"],
  ["v2", RoastDisplayV2, "Start Landing Interviews"],
])("RoastDisplay %s", (_variant, RoastDisplay, pageEndCtaText) => {
  describe("creator view", () => {
    it("renders the conversion module after the score plus the page-end CTA", () => {
      render(<RoastDisplay roast={roast} roastId={roastId} isCreator />);

      BENEFIT_BULLETS.forEach((bullet) => {
        expect(screen.getByText(bullet)).toBeInTheDocument();
      });
      expect(screen.getByText("Sign up free")).toBeInTheDocument();
      expect(screen.getByText(pageEndCtaText)).toBeInTheDocument();
    });

    it("fires roast_signup_clicked with placement after_score from the module CTA", () => {
      render(<RoastDisplay roast={roast} roastId={roastId} isCreator />);

      fireEvent.click(screen.getByText("Sign up free"));

      expect(mockTrackEvent).toHaveBeenCalledWith("roast_signup_clicked", {
        roastId,
        source: "results_page",
        placement: "after_score",
      });
      expect(mockPush).toHaveBeenCalledWith(ROAST_SIGNUP_URL);
    });

    it("fires roast_signup_clicked with placement page_end from the page-end CTA", () => {
      render(<RoastDisplay roast={roast} roastId={roastId} isCreator />);

      fireEvent.click(screen.getByText(pageEndCtaText));

      expect(mockTrackEvent).toHaveBeenCalledWith("roast_signup_clicked", {
        roastId,
        source: "results_page",
        placement: "page_end",
      });
      expect(mockPush).toHaveBeenCalledWith(ROAST_SIGNUP_URL);
    });

    it("fires roast_try_another from the secondary CTA", () => {
      render(<RoastDisplay roast={roast} roastId={roastId} isCreator />);

      fireEvent.click(screen.getByText("Roast Another Resume"));

      expect(mockTrackEvent).toHaveBeenCalledWith("roast_try_another", {
        roastId,
      });
    });
  });

  describe("visitor view", () => {
    it("does not render the creator conversion module", () => {
      render(<RoastDisplay roast={roast} roastId={roastId} isCreator={false} />);

      expect(screen.queryByText("Sign up free")).not.toBeInTheDocument();
      BENEFIT_BULLETS.forEach((bullet) => {
        expect(screen.queryByText(bullet)).not.toBeInTheDocument();
      });
    });

    it("keeps the existing visitor CTAs", () => {
      render(<RoastDisplay roast={roast} roastId={roastId} isCreator={false} />);

      expect(screen.getByText("Think You Can Do Better?")).toBeInTheDocument();
      expect(screen.getByText("Roast My Resume Now")).toBeInTheDocument();
      expect(screen.getByText("Sign Up for CareerOtter")).toBeInTheDocument();
    });

    it("fires roast_signup_clicked with placement visitor_view and navigates with UTMs", () => {
      render(<RoastDisplay roast={roast} roastId={roastId} isCreator={false} />);

      fireEvent.click(screen.getByText("Sign Up for CareerOtter"));

      expect(mockTrackEvent).toHaveBeenCalledWith("roast_signup_clicked", {
        roastId,
        source: "visitor_view",
        placement: "visitor_view",
      });
      // Distinct medium so shared-roast visitor conversions don't inflate the
      // creator results-page funnel.
      expect(mockPush).toHaveBeenCalledWith(ROAST_VISITOR_SIGNUP_URL);
    });
  });
});
