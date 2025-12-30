/**
 * Tests for ResumeService business logic
 * Tests multi-resume management, plan-based limits, and default resume handling
 */

import { ResumeService } from '@/services/resumes';
import { ResumeDAL } from '@/dal/resumes';
import { getSubscription } from '@/lib/supabase/queries';
import { PLAN_NAMES } from '@/lib/constants/plans';
import type { UserResume } from '@/types';

// Mock dependencies
jest.mock('@/dal/resumes', () => ({
  ResumeDAL: jest.fn().mockImplementation(() => ({
    count: jest.fn(),
    findById: jest.fn(),
    findDefaultByUserId: jest.fn(),
    findAllByUserId: jest.fn(),
    setAsDefault: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  })),
}));

jest.mock('@/lib/supabase/queries', () => ({
  getSubscription: jest.fn(),
}));

const mockGetSubscription = getSubscription as jest.MockedFunction<typeof getSubscription>;

describe('ResumeService', () => {
  let resumeService: ResumeService;
  const userId = 'test-user-123';
  const resumeId = 'resume-456';

  const mockResume: UserResume = {
    id: resumeId,
    user_id: userId,
    name: 'My Resume',
    description: 'Software Engineer Resume',
    file_url: 'https://example.com/resume.pdf',
    file_type: 'application/pdf',
    extracted_text: 'Resume content here',
    is_default: true,
    display_order: 1,
    uploaded_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resumeService = new ResumeService();
  });

  describe('canAddResume - Plan-based limits', () => {
    it('should allow free users to add 1 resume when they have 0', async () => {
      (resumeService as any).resumeDAL.count.mockResolvedValue(0);
      mockGetSubscription.mockResolvedValue(null); // No subscription = Free plan

      const result = await resumeService.canAddResume(userId);

      expect(result).toEqual({
        allowed: true,
        limit: 1,
        current: 0,
        plan: PLAN_NAMES.FREE,
      });
    });

    it('should block free users from adding 2nd resume', async () => {
      (resumeService as any).resumeDAL.count.mockResolvedValue(1);
      mockGetSubscription.mockResolvedValue(null);

      const result = await resumeService.canAddResume(userId);

      expect(result).toEqual({
        allowed: false,
        limit: 1,
        current: 1,
        plan: PLAN_NAMES.FREE,
      });
    });

    it('should allow AI Coach users to add up to 100 resumes', async () => {
      (resumeService as any).resumeDAL.count.mockResolvedValue(50);
      mockGetSubscription.mockResolvedValue({
        id: 'sub-1',
        user_id: userId,
        plan_id: 'plan-ai-coach',
        status: 'active',
        current_period_start: '2024-01-01',
        current_period_end: '2024-02-01',
        cancel_at_period_end: false,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        subscription_plans: {
          id: 'plan-ai-coach',
          name: PLAN_NAMES.AI_COACH,
          stripe_product_id: 'prod_123',
          stripe_price_id: 'price_123',
          price: 9,
          billing_period: 'month',
          features: {},
          is_active: true,
          display_order: 2,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      });

      const result = await resumeService.canAddResume(userId);

      expect(result).toEqual({
        allowed: true,
        limit: 100,
        current: 50,
        plan: PLAN_NAMES.AI_COACH,
      });
    });

    it('should block AI Coach users from adding 101st resume', async () => {
      (resumeService as any).resumeDAL.count.mockResolvedValue(100);
      mockGetSubscription.mockResolvedValue({
        id: 'sub-1',
        user_id: userId,
        plan_id: 'plan-ai-coach',
        status: 'active',
        current_period_start: '2024-01-01',
        current_period_end: '2024-02-01',
        cancel_at_period_end: false,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        subscription_plans: {
          id: 'plan-ai-coach',
          name: PLAN_NAMES.AI_COACH,
          stripe_product_id: 'prod_123',
          stripe_price_id: 'price_123',
          price: 9,
          billing_period: 'month',
          features: {},
          is_active: true,
          display_order: 2,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      });

      const result = await resumeService.canAddResume(userId);

      expect(result).toEqual({
        allowed: false,
        limit: 100,
        current: 100,
        plan: PLAN_NAMES.AI_COACH,
      });
    });

    it('should allow Pro users to add up to 100 resumes', async () => {
      (resumeService as any).resumeDAL.count.mockResolvedValue(75);
      mockGetSubscription.mockResolvedValue({
        id: 'sub-1',
        user_id: userId,
        plan_id: 'plan-pro',
        status: 'active',
        current_period_start: '2024-01-01',
        current_period_end: '2024-02-01',
        cancel_at_period_end: false,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        subscription_plans: {
          id: 'plan-pro',
          name: PLAN_NAMES.PRO,
          stripe_product_id: 'prod_456',
          stripe_price_id: 'price_456',
          price: 29,
          billing_period: 'month',
          features: {},
          is_active: true,
          display_order: 3,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      });

      const result = await resumeService.canAddResume(userId);

      expect(result).toEqual({
        allowed: true,
        limit: 100,
        current: 75,
        plan: PLAN_NAMES.PRO,
      });
    });

    it('should handle trialing subscriptions correctly', async () => {
      (resumeService as any).resumeDAL.count.mockResolvedValue(5);
      mockGetSubscription.mockResolvedValue({
        id: 'sub-1',
        user_id: userId,
        plan_id: 'plan-ai-coach',
        status: 'trialing',
        current_period_start: '2024-01-01',
        current_period_end: '2024-02-01',
        cancel_at_period_end: false,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        subscription_plans: {
          id: 'plan-ai-coach',
          name: PLAN_NAMES.AI_COACH,
          stripe_product_id: 'prod_123',
          stripe_price_id: 'price_123',
          price: 9,
          billing_period: 'month',
          features: {},
          is_active: true,
          display_order: 2,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      });

      const result = await resumeService.canAddResume(userId);

      expect(result).toEqual({
        allowed: true,
        limit: 100,
        current: 5,
        plan: PLAN_NAMES.AI_COACH,
      });
    });
  });

  describe('setDefaultResume - Authorization & Validation', () => {
    it('should successfully set resume as default for authorized user', async () => {
      const updatedResume = { ...mockResume, is_default: true };

      (resumeService as any).resumeDAL.findById.mockResolvedValue(mockResume);
      (resumeService as any).resumeDAL.setAsDefault.mockResolvedValue(updatedResume);

      const result = await resumeService.setDefaultResume(resumeId, userId);

      expect(result).toEqual(updatedResume);
      expect((resumeService as any).resumeDAL.findById).toHaveBeenCalledWith(resumeId);
      expect((resumeService as any).resumeDAL.setAsDefault).toHaveBeenCalledWith(resumeId);
    });

    it('should throw error when resume does not exist', async () => {
      (resumeService as any).resumeDAL.findById.mockResolvedValue(null);

      await expect(
        resumeService.setDefaultResume(resumeId, userId)
      ).rejects.toThrow('Resume');
    });

    it('should throw error when user tries to set another user\'s resume as default', async () => {
      const otherUserResume = { ...mockResume, user_id: 'other-user-789' };

      (resumeService as any).resumeDAL.findById.mockResolvedValue(otherUserResume);

      await expect(
        resumeService.setDefaultResume(resumeId, userId)
      ).rejects.toThrow('Unauthorized');
    });

    it('should handle DAL errors gracefully', async () => {
      (resumeService as any).resumeDAL.findById.mockResolvedValue(mockResume);
      (resumeService as any).resumeDAL.setAsDefault.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        resumeService.setDefaultResume(resumeId, userId)
      ).rejects.toThrow();
    });
  });

  describe('getDefaultResume', () => {
    it('should return default resume when it exists', async () => {
      (resumeService as any).resumeDAL.findDefaultByUserId.mockResolvedValue(mockResume);

      const result = await resumeService.getDefaultResume(userId);

      expect(result).toEqual(mockResume);
      expect((resumeService as any).resumeDAL.findDefaultByUserId).toHaveBeenCalledWith(userId);
    });

    it('should return null when no default resume exists', async () => {
      (resumeService as any).resumeDAL.findDefaultByUserId.mockResolvedValue(null);

      const result = await resumeService.getDefaultResume(userId);

      expect(result).toBeNull();
    });

    it('should wrap DAL errors', async () => {
      (resumeService as any).resumeDAL.findDefaultByUserId.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        resumeService.getDefaultResume(userId)
      ).rejects.toThrow();
    });
  });

  describe('getAllResumes', () => {
    it('should return all resumes sorted by display_order', async () => {
      const resumes: UserResume[] = [
        { ...mockResume, id: 'resume-1', name: 'Resume 1', display_order: 1 },
        { ...mockResume, id: 'resume-2', name: 'Resume 2', display_order: 2 },
        { ...mockResume, id: 'resume-3', name: 'Resume 3', display_order: 3 },
      ];

      (resumeService as any).resumeDAL.findAllByUserId.mockResolvedValue(resumes);

      const result = await resumeService.getAllResumes(userId);

      expect(result).toEqual(resumes);
      expect(result).toHaveLength(3);
      expect((resumeService as any).resumeDAL.findAllByUserId).toHaveBeenCalledWith(userId);
    });

    it('should return empty array when user has no resumes', async () => {
      (resumeService as any).resumeDAL.findAllByUserId.mockResolvedValue([]);

      const result = await resumeService.getAllResumes(userId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should wrap DAL errors', async () => {
      (resumeService as any).resumeDAL.findAllByUserId.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        resumeService.getAllResumes(userId)
      ).rejects.toThrow();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle user upgrading from Free to AI Coach plan', async () => {
      // User has 1 resume on Free plan
      (resumeService as any).resumeDAL.count.mockResolvedValue(1);
      mockGetSubscription.mockResolvedValue(null);

      let result = await resumeService.canAddResume(userId);
      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(1);

      // User upgrades to AI Coach
      mockGetSubscription.mockResolvedValue({
        id: 'sub-1',
        user_id: userId,
        plan_id: 'plan-ai-coach',
        status: 'active',
        current_period_start: '2024-01-01',
        current_period_end: '2024-02-01',
        cancel_at_period_end: false,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        subscription_plans: {
          id: 'plan-ai-coach',
          name: PLAN_NAMES.AI_COACH,
          stripe_product_id: 'prod_123',
          stripe_price_id: 'price_123',
          price: 9,
          billing_period: 'month',
          features: {},
          is_active: true,
          display_order: 2,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      });

      result = await resumeService.canAddResume(userId);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100);
    });

    it('should handle changing default resume when user has multiple resumes', async () => {
      const resume1 = { ...mockResume, id: 'resume-1', is_default: true };
      const resume2 = { ...mockResume, id: 'resume-2', is_default: false };

      // Set resume2 as default
      (resumeService as any).resumeDAL.findById.mockResolvedValue(resume2);
      (resumeService as any).resumeDAL.setAsDefault.mockResolvedValue({
        ...resume2,
        is_default: true,
      });

      const result = await resumeService.setDefaultResume('resume-2', userId);

      expect(result?.is_default).toBe(true);
      expect(result?.id).toBe('resume-2');
    });

    it('should count resumes correctly after multiple operations', async () => {
      // Start with 0 resumes
      (resumeService as any).resumeDAL.count.mockResolvedValue(0);
      let count = await resumeService.count(userId);
      expect(count).toBe(0);

      // Add 1 resume
      (resumeService as any).resumeDAL.count.mockResolvedValue(1);
      count = await resumeService.count(userId);
      expect(count).toBe(1);

      // Add 2 more resumes
      (resumeService as any).resumeDAL.count.mockResolvedValue(3);
      count = await resumeService.count(userId);
      expect(count).toBe(3);

      // Delete 1 resume
      (resumeService as any).resumeDAL.count.mockResolvedValue(2);
      count = await resumeService.count(userId);
      expect(count).toBe(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle null subscription gracefully (defaults to Free plan)', async () => {
      (resumeService as any).resumeDAL.count.mockResolvedValue(0);
      mockGetSubscription.mockResolvedValue(null);

      const result = await resumeService.canAddResume(userId);

      expect(result.plan).toBe(PLAN_NAMES.FREE);
      expect(result.limit).toBe(1);
    });

    it('should handle subscription without plan details', async () => {
      (resumeService as any).resumeDAL.count.mockResolvedValue(0);
      mockGetSubscription.mockResolvedValue({
        id: 'sub-1',
        user_id: userId,
        plan_id: 'plan-unknown',
        status: 'active',
        current_period_start: '2024-01-01',
        current_period_end: '2024-02-01',
        cancel_at_period_end: false,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        subscription_plans: null as any,
      });

      const result = await resumeService.canAddResume(userId);

      expect(result.plan).toBe(PLAN_NAMES.FREE);
      expect(result.limit).toBe(1);
    });

    it('should handle exactly at limit boundary for free users', async () => {
      (resumeService as any).resumeDAL.count.mockResolvedValue(1);
      mockGetSubscription.mockResolvedValue(null);

      const result = await resumeService.canAddResume(userId);

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(1);
      expect(result.limit).toBe(1);
    });

    it('should handle exactly at limit boundary for paid users', async () => {
      (resumeService as any).resumeDAL.count.mockResolvedValue(100);
      mockGetSubscription.mockResolvedValue({
        id: 'sub-1',
        user_id: userId,
        plan_id: 'plan-ai-coach',
        status: 'active',
        current_period_start: '2024-01-01',
        current_period_end: '2024-02-01',
        cancel_at_period_end: false,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        subscription_plans: {
          id: 'plan-ai-coach',
          name: PLAN_NAMES.AI_COACH,
          stripe_product_id: 'prod_123',
          stripe_price_id: 'price_123',
          price: 9,
          billing_period: 'month',
          features: {},
          is_active: true,
          display_order: 2,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      });

      const result = await resumeService.canAddResume(userId);

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(100);
      expect(result.limit).toBe(100);
    });
  });
});
