/**
 * Tests for TrialBudgetService
 * Tests budget state retrieval, analysis consumption, refunds, and onboarding completion.
 */

import { createClient } from '@/lib/supabase/server';
import { captureServerEvent } from '@/lib/analytics/posthog-server';
import { TRIAL_BUDGET } from '@/lib/constants/ai-limits';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/analytics/posthog-server', () => ({
  captureServerEvent: jest.fn(),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockCaptureServerEvent = captureServerEvent as jest.MockedFunction<typeof captureServerEvent>;

// Build a chainable Supabase mock
function buildSupabaseMock(overrides: Record<string, any> = {}) {
  const subscriptionSingle = jest.fn().mockResolvedValue(
    overrides.subscription ?? { data: null, error: null }
  );
  const profileSingle = jest.fn().mockResolvedValue(
    overrides.profile ?? { data: { ai_analyses_used: 0, ai_trial_onboarding_completed: false }, error: null }
  );
  const updateEq = jest.fn().mockResolvedValue(overrides.update ?? { error: null });
  const rpcFn = jest.fn().mockResolvedValue(overrides.rpc ?? { data: 1, error: null });

  // Track call order to return different results for subscription vs profile queries
  let fromCallCount = 0;
  const fromFn = jest.fn().mockImplementation((table: string) => {
    if (table === 'user_subscriptions') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                single: subscriptionSingle,
              }),
            }),
          }),
        }),
      };
    }
    if (table === 'profiles') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: profileSingle,
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: updateEq,
        }),
      };
    }
    return {};
  });

  const supabase = {
    from: fromFn,
    rpc: rpcFn,
  };

  return { supabase, subscriptionSingle, profileSingle, updateEq, rpcFn };
}

// Import after mocks are set up
import { TrialBudgetService } from '@/lib/services/trial-budget.service';

describe('TrialBudgetService', () => {
  const userId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBudgetState', () => {
    it('returns correct state for a free user with no analyses used', async () => {
      const { supabase } = buildSupabaseMock({
        subscription: { data: null, error: null },
        profile: { data: { ai_analyses_used: 0, ai_trial_onboarding_completed: false }, error: null },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      const result = await TrialBudgetService.getBudgetState(userId);

      expect(result).toEqual({
        analyses_used: 0,
        analyses_limit: TRIAL_BUDGET.LIMIT,
        analyses_remaining: TRIAL_BUDGET.LIMIT,
        is_pro: false,
        onboarding_completed: false,
      });
    });

    it('returns correct state for a free user with some analyses used', async () => {
      const { supabase } = buildSupabaseMock({
        subscription: { data: null, error: null },
        profile: { data: { ai_analyses_used: 3, ai_trial_onboarding_completed: true }, error: null },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      const result = await TrialBudgetService.getBudgetState(userId);

      expect(result).toEqual({
        analyses_used: 3,
        analyses_limit: TRIAL_BUDGET.LIMIT,
        analyses_remaining: 2,
        is_pro: false,
        onboarding_completed: true,
      });
    });

    it('returns remaining 0 when budget fully exhausted', async () => {
      const { supabase } = buildSupabaseMock({
        subscription: { data: null, error: null },
        profile: { data: { ai_analyses_used: 5, ai_trial_onboarding_completed: true }, error: null },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      const result = await TrialBudgetService.getBudgetState(userId);

      expect(result.analyses_remaining).toBe(0);
      expect(result.is_pro).toBe(false);
    });

    it('returns 999 remaining for pro users', async () => {
      const { supabase } = buildSupabaseMock({
        subscription: { data: { status: 'active', plan_id: 'pro-plan' }, error: null },
        profile: { data: { ai_analyses_used: 3, ai_trial_onboarding_completed: false }, error: null },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      const result = await TrialBudgetService.getBudgetState(userId);

      expect(result.is_pro).toBe(true);
      expect(result.analyses_remaining).toBe(999);
      expect(result.analyses_used).toBe(3);
    });

    it('returns 999 remaining for trialing users', async () => {
      const { supabase } = buildSupabaseMock({
        subscription: { data: { status: 'trialing', plan_id: 'pro-plan' }, error: null },
        profile: { data: { ai_analyses_used: 0, ai_trial_onboarding_completed: false }, error: null },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      const result = await TrialBudgetService.getBudgetState(userId);

      expect(result.is_pro).toBe(true);
      expect(result.analyses_remaining).toBe(999);
    });

    it('handles DB error on profile fetch gracefully for free users', async () => {
      const { supabase } = buildSupabaseMock({
        subscription: { data: null, error: null },
        profile: { data: null, error: { message: 'connection timeout' } },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      const result = await TrialBudgetService.getBudgetState(userId);

      expect(result).toEqual({
        analyses_used: 0,
        analyses_limit: TRIAL_BUDGET.LIMIT,
        analyses_remaining: TRIAL_BUDGET.LIMIT,
        is_pro: false,
        onboarding_completed: false,
      });
    });

    it('handles DB error on profile fetch gracefully for pro users', async () => {
      const { supabase } = buildSupabaseMock({
        subscription: { data: { status: 'active', plan_id: 'pro-plan' }, error: null },
        profile: { data: null, error: { message: 'connection timeout' } },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      const result = await TrialBudgetService.getBudgetState(userId);

      expect(result.is_pro).toBe(true);
      expect(result.analyses_remaining).toBe(999);
    });

    it('clamps remaining to 0 when used exceeds limit', async () => {
      const { supabase } = buildSupabaseMock({
        subscription: { data: null, error: null },
        profile: { data: { ai_analyses_used: 10, ai_trial_onboarding_completed: true }, error: null },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      const result = await TrialBudgetService.getBudgetState(userId);

      expect(result.analyses_remaining).toBe(0);
    });
  });

  describe('consumeAnalysis', () => {
    it('allows consumption when budget is available', async () => {
      const { supabase } = buildSupabaseMock({
        subscription: { data: null, error: null },
        profile: { data: { ai_analyses_used: 2, ai_trial_onboarding_completed: true }, error: null },
        rpc: { data: 3, error: null },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      const result = await TrialBudgetService.consumeAnalysis(userId, 'job_fit');

      expect(result.allowed).toBe(true);
      expect(result.budget.analyses_used).toBe(3);
      expect(result.budget.analyses_remaining).toBe(TRIAL_BUDGET.LIMIT - 3);
      expect(mockCaptureServerEvent).toHaveBeenCalledWith(userId, 'ai_trial_analysis_used', {
        analyses_remaining: TRIAL_BUDGET.LIMIT - 3,
        tool_type: 'job_fit',
      });
    });

    it('fires exhausted event when reaching zero remaining', async () => {
      const { supabase } = buildSupabaseMock({
        subscription: { data: null, error: null },
        profile: { data: { ai_analyses_used: 4, ai_trial_onboarding_completed: true }, error: null },
        rpc: { data: 5, error: null },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      const result = await TrialBudgetService.consumeAnalysis(userId, 'cover_letter');

      expect(result.allowed).toBe(true);
      expect(result.budget.analyses_remaining).toBe(0);
      expect(mockCaptureServerEvent).toHaveBeenCalledWith(userId, 'ai_trial_analysis_used', {
        analyses_remaining: 0,
        tool_type: 'cover_letter',
      });
      expect(mockCaptureServerEvent).toHaveBeenCalledWith(userId, 'ai_trial_exhausted', {
        tool_type: 'cover_letter',
      });
    });

    it('denies when budget is already exhausted (rpc returns -1)', async () => {
      const { supabase } = buildSupabaseMock({
        subscription: { data: null, error: null },
        profile: { data: { ai_analyses_used: 5, ai_trial_onboarding_completed: true }, error: null },
        rpc: { data: -1, error: null },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      const result = await TrialBudgetService.consumeAnalysis(userId, 'interview_prep');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('trial_exhausted');
      expect(result.budget.analyses_remaining).toBe(0);
      expect(mockCaptureServerEvent).toHaveBeenCalledWith(userId, 'ai_trial_exhausted', {
        tool_type: 'interview_prep',
      });
    });

    it('bypasses budget entirely for pro users', async () => {
      const { supabase, rpcFn } = buildSupabaseMock({
        subscription: { data: { status: 'active', plan_id: 'pro-plan' }, error: null },
        profile: { data: { ai_analyses_used: 10, ai_trial_onboarding_completed: false }, error: null },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      const result = await TrialBudgetService.consumeAnalysis(userId, 'job_fit');

      expect(result.allowed).toBe(true);
      expect(result.budget.is_pro).toBe(true);
      // RPC should not be called for pro users (only one createClient call for getBudgetState)
      expect(rpcFn).not.toHaveBeenCalled();
      expect(mockCaptureServerEvent).not.toHaveBeenCalled();
    });

    it('denies on DB error to prevent giving away free analyses', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const { supabase } = buildSupabaseMock({
        subscription: { data: null, error: null },
        profile: { data: { ai_analyses_used: 2, ai_trial_onboarding_completed: true }, error: null },
        rpc: { data: null, error: { message: 'DB connection error' } },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      const result = await TrialBudgetService.consumeAnalysis(userId, 'job_fit');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('trial_exhausted');
      consoleSpy.mockRestore();
    });
  });

  describe('refundAnalysis', () => {
    it('calls refund RPC and fires PostHog event', async () => {
      const { supabase, rpcFn } = buildSupabaseMock({
        rpc: { error: null },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      await TrialBudgetService.refundAnalysis(userId, 'job_fit');

      expect(rpcFn).toHaveBeenCalledWith('refund_ai_analysis', {
        p_user_id: userId,
      });
      expect(mockCaptureServerEvent).toHaveBeenCalledWith(userId, 'ai_trial_analysis_refunded', {
        tool_type: 'job_fit',
        error_reason: 'analysis_failed',
      });
    });

    it('handles RPC error gracefully without firing event', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const { supabase } = buildSupabaseMock({
        rpc: { error: { message: 'DB error' } },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      await TrialBudgetService.refundAnalysis(userId, 'cover_letter');

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockCaptureServerEvent).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('completeOnboarding', () => {
    it('updates profile and fires PostHog event', async () => {
      const { supabase, updateEq } = buildSupabaseMock({
        update: { error: null },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      await TrialBudgetService.completeOnboarding(userId);

      expect(supabase.from).toHaveBeenCalledWith('profiles');
      expect(mockCaptureServerEvent).toHaveBeenCalledWith(userId, 'ai_trial_onboarding_completed');
    });

    it('handles update error gracefully without firing event', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const { supabase } = buildSupabaseMock({
        update: { error: { message: 'update failed' } },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      await TrialBudgetService.completeOnboarding(userId);

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockCaptureServerEvent).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
