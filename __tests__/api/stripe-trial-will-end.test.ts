/**
 * Tests for handleTrialWillEnd (Stripe `customer.subscription.trial_will_end`).
 *
 * This handler sends a compliance-required pre-charge notice. Behavior under
 * test: it only emails trials that will actually charge, dedupes via
 * `trial_ending_notified_at`, stamps that column only after a successful send,
 * captures the analytics event, and RETHROWS on send failure so Stripe retries.
 *
 * The route module imports heavy server deps at load; mock them so the handler
 * can be imported in isolation (mirrors stripe-status-map.test.ts).
 */

jest.mock('@/lib/stripe');
jest.mock('@/services/subscriptions');
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/email/transactional');
jest.mock('@/lib/analytics/posthog-server');
jest.mock('@/lib/services/logger.service', () => ({
  loggerService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// `after` runs its callback synchronously in tests so we can assert captures.
jest.mock('next/server', () => ({
  after: (fn: () => unknown) => fn(),
}));

import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { sendTrialEndingEmail } from '@/lib/email/transactional';
import { captureServerEvent } from '@/lib/analytics/posthog-server';
import { handleTrialWillEnd } from '@/app/api/stripe/webhook/route';

const mockStripe = stripe as jest.Mocked<typeof stripe>;
const mockSendTrialEndingEmail = sendTrialEndingEmail as jest.MockedFunction<
  typeof sendTrialEndingEmail
>;
const mockCaptureServerEvent = captureServerEvent as jest.MockedFunction<
  typeof captureServerEvent
>;

type FakeSubscriptionService = {
  findByStripeSubscriptionId: jest.Mock;
  updateFromStripeWebhook: jest.Mock;
};

function makeSubscriptionService(
  overrides?: Partial<FakeSubscriptionService>
): FakeSubscriptionService {
  return {
    // Default: a local row exists (the idempotency anchor) with no prior
    // notification. Tests that exercise the missing-row path override this.
    findByStripeSubscriptionId: jest.fn().mockResolvedValue({
      user_id: 'user_abc',
      trial_ending_notified_at: null,
    }),
    updateFromStripeWebhook: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// Service-role client stub: only the plan-name lookup chain is exercised.
function makeServiceClient(planName: string | null = 'Pro Plan') {
  const maybeSingle = jest
    .fn()
    .mockResolvedValue({ data: planName ? { name: planName } : null, error: null });
  const or = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ or });
  const from = jest.fn().mockReturnValue({ select });
  return { from } as any;
}

function makeSubscription(
  overrides?: Partial<Stripe.Subscription>
): Stripe.Subscription {
  return {
    id: 'sub_123',
    customer: 'cus_123',
    status: 'trialing',
    cancel_at_period_end: false,
    default_payment_method: null,
    // ~3 days out so the FIX 3 stale-trial_end guard never trips for the
    // happy-path tests. The dedicated stale test overrides this with a past value.
    trial_end: Math.floor((Date.now() + 3 * 24 * 60 * 60 * 1000) / 1000),
    metadata: { userId: 'user_abc' },
    items: {
      data: [
        {
          price: {
            id: 'price_monthly',
            unit_amount: 900,
            currency: 'usd',
            recurring: { interval: 'month', interval_count: 1 },
          },
        },
      ],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function mockCustomer(customer: Record<string, unknown>) {
  (mockStripe.customers as any) = {
    retrieve: jest.fn().mockResolvedValue(customer),
  };
}

describe('handleTrialWillEnd', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendTrialEndingEmail.mockResolvedValue({ success: true });
    mockCaptureServerEvent.mockResolvedValue(undefined);
    // Default: card on the customer (Checkout trial shape).
    mockCustomer({
      email: 'trialer@example.com',
      invoice_settings: { default_payment_method: 'pm_123' },
      default_source: null,
    });
  });

  it('happy path: sends email, stamps row, captures event', async () => {
    const subscriptionService = makeSubscriptionService();
    const serviceClient = makeServiceClient('Pro Plan');

    await handleTrialWillEnd(
      makeSubscription(),
      subscriptionService as any,
      serviceClient
    );

    expect(mockSendTrialEndingEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'trialer@example.com',
        planName: 'Pro Plan',
        amountFormatted: '$9.00',
        cadence: 'month',
        manageUrl: expect.stringContaining('/dashboard/settings'),
      })
    );
    expect(subscriptionService.updateFromStripeWebhook).toHaveBeenCalledWith(
      'sub_123',
      expect.objectContaining({
        trial_ending_notified_at: expect.any(String),
      })
    );
    expect(mockCaptureServerEvent).toHaveBeenCalledWith(
      'user_abc',
      'trial_ending_notified',
      expect.objectContaining({
        subscription_id: 'sub_123',
        amount_cents: 900,
        currency: 'usd',
        interval: 'month',
      })
    );
  });

  it('sends when card is on the customer only (subscription field null)', async () => {
    mockCustomer({
      email: 'trialer@example.com',
      invoice_settings: { default_payment_method: 'pm_cust' },
      default_source: null,
    });
    const subscriptionService = makeSubscriptionService();

    await handleTrialWillEnd(
      makeSubscription({ default_payment_method: null }),
      subscriptionService as any,
      makeServiceClient()
    );

    expect(mockSendTrialEndingEmail).toHaveBeenCalledTimes(1);
  });

  it('idempotent skip: does nothing when already notified', async () => {
    const subscriptionService = makeSubscriptionService({
      findByStripeSubscriptionId: jest.fn().mockResolvedValue({
        user_id: 'user_abc',
        trial_ending_notified_at: '2026-01-01T00:00:00.000Z',
      }),
    });

    await handleTrialWillEnd(
      makeSubscription(),
      subscriptionService as any,
      makeServiceClient()
    );

    expect(mockSendTrialEndingEmail).not.toHaveBeenCalled();
    expect(subscriptionService.updateFromStripeWebhook).not.toHaveBeenCalled();
  });

  it('skips when cancel_at_period_end is true', async () => {
    const subscriptionService = makeSubscriptionService();

    await handleTrialWillEnd(
      makeSubscription({ cancel_at_period_end: true }),
      subscriptionService as any,
      makeServiceClient()
    );

    expect(mockSendTrialEndingEmail).not.toHaveBeenCalled();
  });

  it('skips when no payment method anywhere', async () => {
    mockCustomer({
      email: 'trialer@example.com',
      invoice_settings: { default_payment_method: null },
      default_source: null,
    });
    const subscriptionService = makeSubscriptionService();

    await handleTrialWillEnd(
      makeSubscription({ default_payment_method: null }),
      subscriptionService as any,
      makeServiceClient()
    );

    expect(mockSendTrialEndingEmail).not.toHaveBeenCalled();
  });

  it('skips when trial_end is null', async () => {
    const subscriptionService = makeSubscriptionService();

    await handleTrialWillEnd(
      makeSubscription({ trial_end: null }),
      subscriptionService as any,
      makeServiceClient()
    );

    expect(mockSendTrialEndingEmail).not.toHaveBeenCalled();
  });

  it('uses generic copy (no amount) when unit_amount is null', async () => {
    const subscriptionService = makeSubscriptionService();
    const sub = makeSubscription();
    (sub.items.data[0].price as any).unit_amount = null;

    await handleTrialWillEnd(sub, subscriptionService as any, makeServiceClient());

    expect(mockSendTrialEndingEmail).toHaveBeenCalledWith(
      expect.objectContaining({ amountFormatted: undefined })
    );
  });

  it('rethrows on send failure and does not stamp the row', async () => {
    mockSendTrialEndingEmail.mockResolvedValue({ success: false });
    const subscriptionService = makeSubscriptionService();

    await expect(
      handleTrialWillEnd(
        makeSubscription(),
        subscriptionService as any,
        makeServiceClient()
      )
    ).rejects.toThrow();

    expect(subscriptionService.updateFromStripeWebhook).not.toHaveBeenCalled();
  });

  it('returns without sending when userId cannot be resolved', async () => {
    const subscriptionService = makeSubscriptionService({
      findByStripeSubscriptionId: jest.fn().mockResolvedValue(null),
    });
    const sub = makeSubscription({ metadata: {} });

    await handleTrialWillEnd(sub, subscriptionService as any, makeServiceClient());

    expect(mockSendTrialEndingEmail).not.toHaveBeenCalled();
    expect(subscriptionService.updateFromStripeWebhook).not.toHaveBeenCalled();
  });

  it('does not send when there is no local row, even if metadata has userId', async () => {
    // Without a local row we cannot stamp trial_ending_notified_at, so sending
    // would risk a duplicate on Stripe redelivery. Require the row.
    const subscriptionService = makeSubscriptionService({
      findByStripeSubscriptionId: jest.fn().mockResolvedValue(null),
    });
    // metadata.userId is set, so userId resolves — but local row is null.
    const sub = makeSubscription({ metadata: { userId: 'user_abc' } });

    await handleTrialWillEnd(sub, subscriptionService as any, makeServiceClient());

    expect(mockSendTrialEndingEmail).not.toHaveBeenCalled();
    expect(subscriptionService.updateFromStripeWebhook).not.toHaveBeenCalled();
  });

  it('skips when trial_end is already in the past', async () => {
    const subscriptionService = makeSubscriptionService();
    // A trial_end well in the past (e.g. a late/retried event).
    const pastTrialEnd = Math.floor((Date.now() - 60_000) / 1000);

    await handleTrialWillEnd(
      makeSubscription({ trial_end: pastTrialEnd }),
      subscriptionService as any,
      makeServiceClient()
    );

    expect(mockSendTrialEndingEmail).not.toHaveBeenCalled();
    expect(subscriptionService.updateFromStripeWebhook).not.toHaveBeenCalled();
  });

  it('formats multi-count cadence without "every" (e.g. "3 months")', async () => {
    const subscriptionService = makeSubscriptionService();
    const sub = makeSubscription();
    (sub.items.data[0].price as any).recurring = {
      interval: 'month',
      interval_count: 3,
    };

    await handleTrialWillEnd(sub, subscriptionService as any, makeServiceClient());

    expect(mockSendTrialEndingEmail).toHaveBeenCalledWith(
      expect.objectContaining({ cadence: '3 months' })
    );
  });
});
