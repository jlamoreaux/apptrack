/**
 * Tests for the AppTrack -> CareerOtter transition banner.
 *
 * Contract: shown only to existing users (created before the cutover) while the
 * window env is "on" and it hasn't been dismissed on this device; hidden for new
 * users, when the window is off, and after dismissal (persisted to localStorage).
 */

jest.mock("@/hooks/use-supabase-auth", () => ({
  useSupabaseAuth: jest.fn(),
}));

jest.mock("@/lib/analytics/posthog", () => ({
  capturePostHogEvent: jest.fn(),
}));

// next/link is globally mocked in jest.setup.js. The global lucide-react mock
// there has a fixed icon list that omits X, so mock the icon this component uses.
jest.mock("lucide-react", () => ({
  X: () => <span data-testid="x-icon" />,
}));

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { RebrandBanner } from "@/components/rebrand-banner";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { REBRAND_COPY } from "@/lib/constants/rebrand";

const mockUseAuth = useSupabaseAuth as jest.MockedFunction<typeof useSupabaseAuth>;
const mockCapture = capturePostHogEvent as jest.MockedFunction<typeof capturePostHogEvent>;

const CUTOVER = "2026-08-01T00:00:00.000Z";
const BEFORE = "2026-07-01T00:00:00.000Z";
const AFTER = "2026-08-15T00:00:00.000Z";

function mockUser(createdAt: string) {
  mockUseAuth.mockReturnValue({ user: { created_at: createdAt }, loading: false } as never);
}

describe("RebrandBanner", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    process.env.NEXT_PUBLIC_REBRAND_BANNER = "on";
    process.env.NEXT_PUBLIC_REBRAND_CUTOVER_AT = CUTOVER;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("shows for an existing user during the window and fires the shown event", async () => {
    mockUser(BEFORE);
    render(<RebrandBanner />);
    expect(await screen.findByText(REBRAND_COPY.headline)).toBeInTheDocument();
    await waitFor(() => expect(mockCapture).toHaveBeenCalledWith("rebrand_banner_shown"));
  });

  it("hides for a user created at/after the cutover", async () => {
    mockUser(AFTER);
    render(<RebrandBanner />);
    await waitFor(() => {
      expect(screen.queryByText(REBRAND_COPY.headline)).not.toBeInTheDocument();
    });
  });

  it("hides when the window env is not 'on'", async () => {
    process.env.NEXT_PUBLIC_REBRAND_BANNER = "off";
    mockUser(BEFORE);
    render(<RebrandBanner />);
    await waitFor(() => {
      expect(screen.queryByText(REBRAND_COPY.headline)).not.toBeInTheDocument();
    });
  });

  it("hides when already dismissed on this device", async () => {
    localStorage.setItem("ff:rebrand-banner-dismissed", "true");
    mockUser(BEFORE);
    render(<RebrandBanner />);
    await waitFor(() => {
      expect(screen.queryByText(REBRAND_COPY.headline)).not.toBeInTheDocument();
    });
  });

  it("dismiss hides the banner, persists, and fires the dismissed event", async () => {
    mockUser(BEFORE);
    render(<RebrandBanner />);
    await screen.findByText(REBRAND_COPY.headline);

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    await waitFor(() => {
      expect(screen.queryByText(REBRAND_COPY.headline)).not.toBeInTheDocument();
    });
    expect(localStorage.getItem("ff:rebrand-banner-dismissed")).toBe("true");
    expect(mockCapture).toHaveBeenCalledWith("rebrand_banner_dismissed");
  });

  it("hides when no user is authenticated", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false } as never);
    render(<RebrandBanner />);
    await waitFor(() => {
      expect(screen.queryByText(REBRAND_COPY.headline)).not.toBeInTheDocument();
    });
  });
});
