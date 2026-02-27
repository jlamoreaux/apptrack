import { resolveTrialDays } from '@/hooks/use-trial-management';
import type { PromoCode } from '@/types/promo-codes';

const makePromo = (overrides: Partial<PromoCode>): PromoCode => ({
  id: 'promo-1',
  code: 'TEST14',
  description: 'Test promo',
  code_type: 'trial',
  trial_days: 14,
  used_count: 0,
  active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('resolveTrialDays', () => {
  it('returns traffic source trial days when available', () => {
    expect(resolveTrialDays(7)).toBe(7);
  });

  it('returns traffic source trial days even when promo also has trial_days', () => {
    const promo = makePromo({ trial_days: 14 });
    expect(resolveTrialDays(7, promo)).toBe(7);
  });

  it('falls back to promo code trial_days when traffic source returns 0', () => {
    const promo = makePromo({ code_type: 'trial', trial_days: 14 });
    expect(resolveTrialDays(0, promo)).toBe(14);
  });

  it('returns 0 when no traffic trial and no promo', () => {
    expect(resolveTrialDays(0)).toBe(0);
  });

  it('returns 0 when no traffic trial and promo is null', () => {
    expect(resolveTrialDays(0, null)).toBe(0);
  });

  it('returns 0 when promo is a discount code (not trial)', () => {
    const promo = makePromo({ code_type: 'discount', trial_days: undefined });
    expect(resolveTrialDays(0, promo)).toBe(0);
  });

  it('returns 0 when promo is premium_free', () => {
    const promo = makePromo({ code_type: 'premium_free', trial_days: undefined });
    expect(resolveTrialDays(0, promo)).toBe(0);
  });

  it('returns 0 when promo is trial type but trial_days is undefined', () => {
    const promo = makePromo({ code_type: 'trial', trial_days: undefined });
    expect(resolveTrialDays(0, promo)).toBe(0);
  });

  it('handles promo with trial_days of 0 explicitly', () => {
    const promo = makePromo({ code_type: 'trial', trial_days: 0 });
    expect(resolveTrialDays(0, promo)).toBe(0);
  });

  it('handles large trial day values', () => {
    const promo = makePromo({ code_type: 'trial', trial_days: 90 });
    expect(resolveTrialDays(0, promo)).toBe(90);
  });
});
