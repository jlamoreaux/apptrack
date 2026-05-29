/**
 * Tests for mapStripeStatus (Stripe webhook status mapping).
 *
 * The mapping must FAIL CLOSED: only Stripe's "active"/"trialing" grant
 * entitlements downstream, so every non-paying or unknown Stripe status must
 * map to a non-entitled value ("canceled"). This guards the payment write-path
 * against silently granting plans to incomplete/unpaid/paused/future statuses.
 */

// The route module imports heavy server deps at module load; mock them so the
// pure mapping function can be imported in isolation (mirrors stripe-webhook.test.ts).
jest.mock('@/lib/stripe');
jest.mock('@/services/subscriptions');
jest.mock('@/lib/supabase/server');

import { mapStripeStatus } from '@/app/api/stripe/webhook/route';
import { isEntitledStatus } from '@/lib/constants/subscription-status';

describe('mapStripeStatus', () => {
  const cases: Array<[string, 'active' | 'trialing' | 'past_due' | 'canceled']> = [
    ['active', 'active'],
    ['trialing', 'trialing'],
    ['past_due', 'past_due'],
    ['canceled', 'canceled'],
    ['incomplete', 'canceled'],
    ['incomplete_expired', 'canceled'],
    ['unpaid', 'canceled'],
    ['paused', 'canceled'],
    ['some_future_status', 'canceled'],
  ];

  it.each(cases)('maps Stripe status "%s" -> "%s"', (input, expected) => {
    expect(mapStripeStatus(input)).toBe(expected);
  });

  it('never grants entitlements for non-active/non-trialing Stripe statuses', () => {
    const nonEntitled = [
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid',
      'paused',
      'some_future_status',
    ];
    for (const status of nonEntitled) {
      expect(isEntitledStatus(mapStripeStatus(status))).toBe(false);
    }
  });
});
