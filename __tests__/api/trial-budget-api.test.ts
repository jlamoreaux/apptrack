/**
 * Tests for /api/ai-coach/trial-budget route handlers
 * Tests GET (budget state retrieval) and POST (onboarding completion).
 */

import { createClient } from '@/lib/supabase/server';
import { TrialBudgetService } from '@/lib/services/trial-budget.service';
import { TRIAL_BUDGET } from '@/lib/constants/ai-limits';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/services/trial-budget.service', () => ({
  TrialBudgetService: {
    getBudgetState: jest.fn(),
    completeOnboarding: jest.fn(),
  },
}));

jest.mock('@/lib/analytics/posthog-server', () => ({
  captureServerEvent: jest.fn(),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetBudgetState = TrialBudgetService.getBudgetState as jest.MockedFunction<typeof TrialBudgetService.getBudgetState>;
const mockCompleteOnboarding = TrialBudgetService.completeOnboarding as jest.MockedFunction<typeof TrialBudgetService.completeOnboarding>;

import { GET, POST } from '@/app/api/ai-coach/trial-budget/route';

function mockAuthenticatedUser(userId: string) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: userId } },
      }),
    },
  } as any);
}

function mockUnauthenticatedUser() {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: null },
      }),
    },
  } as any);
}

describe('/api/ai-coach/trial-budget', () => {
  const userId = 'test-user-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('returns budget state for authenticated user', async () => {
      mockAuthenticatedUser(userId);

      const budgetState = {
        analyses_used: 2,
        analyses_limit: TRIAL_BUDGET.LIMIT,
        analyses_remaining: 3,
        is_pro: false,
        onboarding_completed: true,
      };
      mockGetBudgetState.mockResolvedValue(budgetState);

      const response = await GET();
      const data = await response.json();

      expect(mockGetBudgetState).toHaveBeenCalledWith(userId);
      expect(data).toEqual(budgetState);
      expect(response.status).toBe(200);
    });

    it('returns 401 for unauthenticated user', async () => {
      mockUnauthenticatedUser();

      const response = await GET();
      const data = await response.json();

      expect(data.error).toBe('Unauthorized');
      expect(response.status).toBe(401);
      expect(mockGetBudgetState).not.toHaveBeenCalled();
    });

    it('returns pro user budget state', async () => {
      mockAuthenticatedUser(userId);

      const budgetState = {
        analyses_used: 0,
        analyses_limit: TRIAL_BUDGET.LIMIT,
        analyses_remaining: 999,
        is_pro: true,
        onboarding_completed: false,
      };
      mockGetBudgetState.mockResolvedValue(budgetState);

      const response = await GET();
      const data = await response.json();

      expect(data.is_pro).toBe(true);
      expect(data.analyses_remaining).toBe(999);
    });
  });

  describe('POST', () => {
    it('marks onboarding complete for authenticated user', async () => {
      mockAuthenticatedUser(userId);
      mockCompleteOnboarding.mockResolvedValue(undefined);

      const response = await POST();
      const data = await response.json();

      expect(mockCompleteOnboarding).toHaveBeenCalledWith(userId);
      expect(data).toEqual({ success: true });
      expect(response.status).toBe(200);
    });

    it('returns 401 for unauthenticated user', async () => {
      mockUnauthenticatedUser();

      const response = await POST();
      const data = await response.json();

      expect(data.error).toBe('Unauthorized');
      expect(response.status).toBe(401);
      expect(mockCompleteOnboarding).not.toHaveBeenCalled();
    });
  });
});
