/**
 * Onboarding honors a validated `next` (e.g. an app connection's consent
 * page) on its non-checkout exits:
 * - finishing on the free plan goes to `next` instead of the first-job step
 * - a user already on a paid plan is sent to `next` instead of /dashboard
 * - an invalid `next` falls back to the usual destinations, including
 *   control characters the URL parser strips (/\t/evil.com and friends)
 * Paid checkout still goes through Stripe (a non-goal).
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OnboardingWelcomePage from "@/app/(app)/onboarding/welcome/page";
import { useSubscription } from "@/hooks/use-subscription";
import { createCheckoutSession } from "@/lib/checkout/create-checkout";

const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/onboarding/welcome",
}));
jest.mock("@/hooks/use-supabase-auth", () => ({
  useSupabaseAuth: () => ({ user: { id: "u1", user_metadata: {} }, loading: false }),
}));
jest.mock("@/hooks/use-subscription", () => ({ useSubscription: jest.fn() }));
jest.mock("@/hooks/use-trial-management", () => ({
  useTrialManagement: () => ({ trafficTrial: null, shouldAutoSelectPlan: false, getTrialDays: () => 0 }),
  resolveTrialDays: () => 0,
}));
jest.mock("@/hooks/use-promo-codes", () => ({
  usePromoCodes: () => ({
    promoCode: "",
    setPromoCode: jest.fn(),
    promoLoading: false,
    promoError: null,
    promoSuccess: false,
    appliedPromo: null,
    showPromoDialog: false,
    setShowPromoDialog: jest.fn(),
    handleApplyPromo: jest.fn(),
  }),
}));
jest.mock("@/lib/checkout/create-checkout", () => ({
  createCheckoutSession: jest.fn(),
  buildCheckoutFallbackUrl: jest.fn(() => "/dashboard/upgrade"),
}));
jest.mock("@/components/onboarding/offer-banner", () => ({ OfferBanner: () => null }));
jest.mock("@/components/onboarding/benefits-section", () => ({ BenefitsSection: () => null }));
jest.mock("@/components/onboarding/billing-toggle", () => ({ BillingToggle: () => null }));
jest.mock("@/components/onboarding/plan-card", () => ({
  PlanCard: ({ plan, onSelect }: { plan: { name: string; buttonText: string }; onSelect: (name: string) => void }) => (
    <button type="button" onClick={() => onSelect(plan.name)}>
      {plan.buttonText}
    </button>
  ),
}));
jest.mock("@/lib/utils/client-logger", () => ({
  clientLogger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockUseSubscription = useSubscription as jest.Mock;
const mockCreateCheckout = createCheckoutSession as jest.Mock;

const CONSENT_PATH = "/oauth/consent?client_id=co_client_x&state=abc";

function onPlan(plan: string | null): void {
  mockUseSubscription.mockReturnValue({
    plans: [],
    loading: false,
    subscription: plan === null ? null : { plan },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  mockCreateCheckout.mockResolvedValue("/onboarding/first-job");
  onPlan(null);
});

describe("onboarding next", () => {
  it("goes to a valid next after finishing on the free plan", async () => {
    mockSearchParams = new URLSearchParams({ next: CONSENT_PATH });
    render(<OnboardingWelcomePage />);
    fireEvent.click(screen.getByRole("button", { name: "Start Free" }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(CONSENT_PATH));
    expect(mockCreateCheckout).toHaveBeenCalled();
  });

  it("keeps the first-job step on the free plan without next", async () => {
    render(<OnboardingWelcomePage />);
    fireEvent.click(screen.getByRole("button", { name: "Start Free" }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/onboarding/first-job"));
  });

  it("sends a user already on a paid plan to a valid next", async () => {
    mockSearchParams = new URLSearchParams({ next: CONSENT_PATH });
    onPlan("AI Coach");
    render(<OnboardingWelcomePage />);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(CONSENT_PATH));
  });

  it.each(["https://evil.example/", "//evil.example/", "/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/\\evil.com"])(
    "falls back to /dashboard for a paid user with next %s",
    async (next) => {
      mockSearchParams = new URLSearchParams({ next });
      onPlan("AI Coach");
      render(<OnboardingWelcomePage />);
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
      expect(mockPush).not.toHaveBeenCalledWith(next);
    }
  );

  it.each(["/%09/evil.com", "/%0a/evil.com", "/%0d/evil.com"])(
    "ignores next=%s once decoded, on the free plan",
    async (raw) => {
      mockSearchParams = new URLSearchParams(`next=${raw}`);
      render(<OnboardingWelcomePage />);
      fireEvent.click(screen.getByRole("button", { name: "Start Free" }));
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/onboarding/first-job"));
    }
  );

  it("returns to a consent next with its onboarded marker intact", async () => {
    const marked = `${CONSENT_PATH}&onboarded=1`;
    mockSearchParams = new URLSearchParams({ next: marked });
    render(<OnboardingWelcomePage />);
    fireEvent.click(screen.getByRole("button", { name: "Start Free" }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(marked));
  });

  it("ignores an invalid next on the free plan", async () => {
    mockSearchParams = new URLSearchParams({ next: "https://evil.example/" });
    render(<OnboardingWelcomePage />);
    fireEvent.click(screen.getByRole("button", { name: "Start Free" }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/onboarding/first-job"));
  });
});
