/**
 * Tests for lib/utils/plan-helpers.ts
 * Subscription plan permission helpers
 */

// @jest-environment node

import {
  isOnFreePlan,
  isOnProOrHigher,
  isOnAICoachPlan,
  isOnPaidPlan,
  getPlanDisplayName,
  getPlanLevel,
  isPlanDowngrade,
  isPlanUpgrade,
  getPlanButtonText,
  getApplicationLimit,
  canAccessAIFeatures,
  canAccessUnlimitedApplications,
  getPlanFeaturesByName,
  hasFeatureAccess,
} from '@/lib/utils/plan-helpers';

// Plan name constants matching the source
const PLANS = {
  FREE: 'Free',
  PRO: 'Pro',
  AI_COACH: 'AI Coach',
};

describe('isOnFreePlan', () => {
  it('returns true for Free plan', () => {
    expect(isOnFreePlan(PLANS.FREE)).toBe(true);
  });

  it('returns false for Pro plan', () => {
    expect(isOnFreePlan(PLANS.PRO)).toBe(false);
  });

  it('returns false for AI Coach plan', () => {
    expect(isOnFreePlan(PLANS.AI_COACH)).toBe(false);
  });
});

describe('isOnProOrHigher', () => {
  it('returns true for Pro plan', () => {
    expect(isOnProOrHigher(PLANS.PRO)).toBe(true);
  });

  it('returns true for AI Coach plan', () => {
    expect(isOnProOrHigher(PLANS.AI_COACH)).toBe(true);
  });

  it('returns false for Free plan', () => {
    expect(isOnProOrHigher(PLANS.FREE)).toBe(false);
  });
});

describe('isOnAICoachPlan', () => {
  it('returns true for AI Coach plan', () => {
    expect(isOnAICoachPlan(PLANS.AI_COACH)).toBe(true);
  });

  it('returns false for Pro plan', () => {
    expect(isOnAICoachPlan(PLANS.PRO)).toBe(false);
  });

  it('returns false for Free plan', () => {
    expect(isOnAICoachPlan(PLANS.FREE)).toBe(false);
  });
});

describe('isOnPaidPlan', () => {
  it('returns true for Pro plan', () => {
    expect(isOnPaidPlan(PLANS.PRO)).toBe(true);
  });

  it('returns true for AI Coach plan', () => {
    expect(isOnPaidPlan(PLANS.AI_COACH)).toBe(true);
  });

  it('returns false for Free plan', () => {
    expect(isOnPaidPlan(PLANS.FREE)).toBe(false);
  });
});

describe('getPlanDisplayName', () => {
  it('returns "Free" for Free plan', () => {
    expect(getPlanDisplayName(PLANS.FREE)).toBe('Free');
  });

  it('returns "Pro" for Pro plan', () => {
    expect(getPlanDisplayName(PLANS.PRO)).toBe('Pro');
  });

  it('returns "AI Coach" for AI Coach plan', () => {
    expect(getPlanDisplayName(PLANS.AI_COACH)).toBe('AI Coach');
  });

  it('returns "Unknown" for unrecognized plan', () => {
    expect(getPlanDisplayName('enterprise')).toBe('Unknown');
  });
});

describe('getPlanLevel', () => {
  it('returns 0 for Free plan', () => {
    expect(getPlanLevel(PLANS.FREE)).toBe(0);
  });

  it('returns 1 for Pro plan', () => {
    expect(getPlanLevel(PLANS.PRO)).toBe(1);
  });

  it('returns 2 for AI Coach plan', () => {
    expect(getPlanLevel(PLANS.AI_COACH)).toBe(2);
  });

  it('returns 0 for unknown plan', () => {
    expect(getPlanLevel('enterprise')).toBe(0);
  });
});

describe('isPlanDowngrade', () => {
  it('returns true when going from AI Coach to Pro', () => {
    expect(isPlanDowngrade(PLANS.AI_COACH, PLANS.PRO)).toBe(true);
  });

  it('returns true when going from AI Coach to Free', () => {
    expect(isPlanDowngrade(PLANS.AI_COACH, PLANS.FREE)).toBe(true);
  });

  it('returns true when going from Pro to Free', () => {
    expect(isPlanDowngrade(PLANS.PRO, PLANS.FREE)).toBe(true);
  });

  it('returns false when going from Free to Pro', () => {
    expect(isPlanDowngrade(PLANS.FREE, PLANS.PRO)).toBe(false);
  });

  it('returns false when going from Free to AI Coach', () => {
    expect(isPlanDowngrade(PLANS.FREE, PLANS.AI_COACH)).toBe(false);
  });

  it('returns false when staying on same plan', () => {
    expect(isPlanDowngrade(PLANS.PRO, PLANS.PRO)).toBe(false);
  });
});

describe('isPlanUpgrade', () => {
  it('returns true when going from Free to AI Coach', () => {
    expect(isPlanUpgrade(PLANS.FREE, PLANS.AI_COACH)).toBe(true);
  });

  it('returns true when going from Free to Pro', () => {
    expect(isPlanUpgrade(PLANS.FREE, PLANS.PRO)).toBe(true);
  });

  it('returns false when going from AI Coach to Pro', () => {
    expect(isPlanUpgrade(PLANS.AI_COACH, PLANS.PRO)).toBe(false);
  });

  it('returns false when staying on same plan', () => {
    expect(isPlanUpgrade(PLANS.PRO, PLANS.PRO)).toBe(false);
  });
});

describe('getPlanButtonText', () => {
  it('returns "Current Plan" when isCurrentPlan is true', () => {
    expect(getPlanButtonText(PLANS.PRO, PLANS.PRO, true)).toBe('Current Plan');
  });

  it('returns upgrade text when moving to higher tier', () => {
    const text = getPlanButtonText(PLANS.FREE, PLANS.AI_COACH, false);
    expect(text).toContain('Upgrade');
  });

  it('returns "Downgrade" when moving to lower tier', () => {
    expect(getPlanButtonText(PLANS.AI_COACH, PLANS.PRO, false)).toBe('Downgrade');
  });

  it('returns "Downgrade" when moving from Pro to Free', () => {
    expect(getPlanButtonText(PLANS.PRO, PLANS.FREE, false)).toBe('Downgrade');
  });
});

describe('getApplicationLimit', () => {
  it('returns a number (the free limit) for Free plan', () => {
    const limit = getApplicationLimit(PLANS.FREE);
    expect(typeof limit).toBe('number');
    expect(limit).toBeGreaterThan(0);
  });

  it('returns null (unlimited) for Pro plan', () => {
    expect(getApplicationLimit(PLANS.PRO)).toBeNull();
  });

  it('returns null (unlimited) for AI Coach plan', () => {
    expect(getApplicationLimit(PLANS.AI_COACH)).toBeNull();
  });
});

describe('canAccessAIFeatures', () => {
  it('returns true for AI Coach plan', () => {
    expect(canAccessAIFeatures(PLANS.AI_COACH)).toBe(true);
  });

  it('returns false for Free plan', () => {
    expect(canAccessAIFeatures(PLANS.FREE)).toBe(false);
  });

  it('returns false for Pro plan', () => {
    expect(canAccessAIFeatures(PLANS.PRO)).toBe(false);
  });
});

describe('canAccessUnlimitedApplications', () => {
  it('returns true for Pro plan', () => {
    expect(canAccessUnlimitedApplications(PLANS.PRO)).toBe(true);
  });

  it('returns true for AI Coach plan', () => {
    expect(canAccessUnlimitedApplications(PLANS.AI_COACH)).toBe(true);
  });

  it('returns false for Free plan', () => {
    expect(canAccessUnlimitedApplications(PLANS.FREE)).toBe(false);
  });
});

describe('getPlanFeaturesByName', () => {
  it('returns an array of strings for Free plan', () => {
    const features = getPlanFeaturesByName(PLANS.FREE);
    expect(Array.isArray(features)).toBe(true);
    expect(features.length).toBeGreaterThan(0);
  });

  it('includes more features for AI Coach than Free', () => {
    const freeFeatures = getPlanFeaturesByName(PLANS.FREE);
    const aiCoachFeatures = getPlanFeaturesByName(PLANS.AI_COACH);
    expect(aiCoachFeatures.length).toBeGreaterThan(freeFeatures.length);
  });

  it('includes core features for all plans', () => {
    [PLANS.FREE, PLANS.PRO, PLANS.AI_COACH].forEach(plan => {
      const features = getPlanFeaturesByName(plan);
      expect(features.length).toBeGreaterThan(0);
    });
  });
});

describe('hasFeatureAccess', () => {
  it('returns true for AI Coach plan accessing RESUME_ANALYSIS', () => {
    expect(hasFeatureAccess(PLANS.AI_COACH, 'RESUME_ANALYSIS')).toBe(true);
  });

  it('returns false for Free plan accessing RESUME_ANALYSIS', () => {
    expect(hasFeatureAccess(PLANS.FREE, 'RESUME_ANALYSIS')).toBe(false);
  });

  it('returns false for Pro plan accessing CAREER_ADVICE', () => {
    expect(hasFeatureAccess(PLANS.PRO, 'CAREER_ADVICE')).toBe(false);
  });
});
