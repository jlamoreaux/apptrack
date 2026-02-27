import { createCheckoutSession } from '@/lib/checkout/create-checkout';
import type { PromoCode } from '@/types/promo-codes';

// Mock the toast hook
jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn(),
}));

// Mock the client logger
jest.mock('@/lib/utils/client-logger', () => ({
  clientLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockFetch = global.fetch as jest.Mock;

beforeEach(() => {
  mockFetch.mockReset();
});

const makeTrialPromo = (days: number): PromoCode => ({
  id: 'promo-trial',
  code: 'TRIAL14',
  description: '14-day trial',
  code_type: 'trial',
  trial_days: days,
  plan_name: 'AI Coach',
  used_count: 0,
  active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
});

function setupFetchMocks(checkoutUrl: string = 'https://checkout.stripe.com/session') {
  mockFetch.mockImplementation((url: string) => {
    if (url === '/api/auth/complete-onboarding') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    if (url === '/api/stripe/create-checkout') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ url: checkoutUrl }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

describe('createCheckoutSession trial days', () => {
  it('passes trialDays to the Stripe checkout API', async () => {
    setupFetchMocks();

    await createCheckoutSession({
      planName: 'AI Coach',
      planId: 'ai-coach',
      selectedBilling: 'monthly',
      trialDays: 14,
    });

    // Find the call to /api/stripe/create-checkout
    const checkoutCall = mockFetch.mock.calls.find(
      (call: any[]) => call[0] === '/api/stripe/create-checkout'
    );

    expect(checkoutCall).toBeDefined();
    const body = JSON.parse(checkoutCall![1].body);
    expect(body.trialDays).toBe(14);
  });

  it('passes 0 trialDays when no trial is active', async () => {
    setupFetchMocks();

    await createCheckoutSession({
      planName: 'AI Coach',
      planId: 'ai-coach',
      selectedBilling: 'monthly',
      trialDays: 0,
    });

    const checkoutCall = mockFetch.mock.calls.find(
      (call: any[]) => call[0] === '/api/stripe/create-checkout'
    );

    expect(checkoutCall).toBeDefined();
    const body = JSON.parse(checkoutCall![1].body);
    expect(body.trialDays).toBe(0);
  });

  it('defaults trialDays to 0 when not provided', async () => {
    setupFetchMocks();

    await createCheckoutSession({
      planName: 'AI Coach',
      planId: 'ai-coach',
      selectedBilling: 'monthly',
    });

    const checkoutCall = mockFetch.mock.calls.find(
      (call: any[]) => call[0] === '/api/stripe/create-checkout'
    );

    expect(checkoutCall).toBeDefined();
    const body = JSON.parse(checkoutCall![1].body);
    expect(body.trialDays).toBe(0);
  });

  it('includes promo stripe_promotion_code_id alongside trialDays', async () => {
    setupFetchMocks();

    const promo: PromoCode = {
      ...makeTrialPromo(14),
      stripe_promotion_code_id: 'promo_abc123',
    };

    await createCheckoutSession({
      planName: 'AI Coach',
      planId: 'ai-coach',
      selectedBilling: 'monthly',
      appliedPromo: promo,
      trialDays: 14,
    });

    const checkoutCall = mockFetch.mock.calls.find(
      (call: any[]) => call[0] === '/api/stripe/create-checkout'
    );

    const body = JSON.parse(checkoutCall![1].body);
    expect(body.trialDays).toBe(14);
    expect(body.promoCode).toBe('promo_abc123');
  });

  it('skips Stripe checkout for premium_free promo codes', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/auth/complete-onboarding') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      if (url === '/api/promo/activate-trial') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const promo: PromoCode = {
      ...makeTrialPromo(0),
      code_type: 'premium_free',
      code: 'PREMIUM_FREE',
    };

    const result = await createCheckoutSession({
      planName: 'AI Coach',
      planId: 'ai-coach',
      selectedBilling: 'monthly',
      appliedPromo: promo,
      trialDays: 0,
    });

    // Should activate via /api/promo/activate-trial, not Stripe
    const activateCall = mockFetch.mock.calls.find(
      (call: any[]) => call[0] === '/api/promo/activate-trial'
    );
    expect(activateCall).toBeDefined();

    // Should NOT call Stripe checkout
    const checkoutCall = mockFetch.mock.calls.find(
      (call: any[]) => call[0] === '/api/stripe/create-checkout'
    );
    expect(checkoutCall).toBeUndefined();

    expect(result).toBe('/dashboard?welcome=success');
  });
});
