/**
 * Tests for useTrialBudget hook
 * Tests fetch on mount, refresh, and completeOnboarding.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { TRIAL_BUDGET } from '@/lib/constants/ai-limits';

// Mock fetch globally (already set in jest.setup but we override per-test)
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { useTrialBudget } from '@/hooks/use-trial-budget';

describe('useTrialBudget', () => {
  const budgetResponse = {
    analyses_used: 2,
    analyses_limit: TRIAL_BUDGET.LIMIT,
    analyses_remaining: 3,
    is_pro: false,
    onboarding_completed: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  it('fetches budget state on mount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => budgetResponse,
    });

    const { result } = renderHook(() => useTrialBudget());

    // Initially loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/ai-coach/trial-budget');
    expect(result.current.budget).toEqual(budgetResponse);
  });

  it('starts with default state before fetch completes', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useTrialBudget());

    expect(result.current.budget).toEqual({
      analyses_used: 0,
      analyses_limit: TRIAL_BUDGET.LIMIT,
      analyses_remaining: TRIAL_BUDGET.LIMIT,
      is_pro: false,
      onboarding_completed: false,
    });
    expect(result.current.loading).toBe(true);
  });

  it('keeps current state on fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useTrialBudget());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should keep default state
    expect(result.current.budget.analyses_remaining).toBe(TRIAL_BUDGET.LIMIT);
  });

  it('keeps current state when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const { result } = renderHook(() => useTrialBudget());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.budget.analyses_remaining).toBe(TRIAL_BUDGET.LIMIT);
  });

  it('provides a refresh function that re-fetches', async () => {
    // Initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => budgetResponse,
    });

    const { result } = renderHook(() => useTrialBudget());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Set up next fetch with updated data
    const updatedBudget = { ...budgetResponse, analyses_used: 3, analyses_remaining: 2 };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => updatedBudget,
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.budget.analyses_remaining).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('completeOnboarding makes POST request and updates state', async () => {
    // Initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...budgetResponse, onboarding_completed: false }),
    });

    const { result } = renderHook(() => useTrialBudget());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.budget.onboarding_completed).toBe(false);

    // POST call for onboarding
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    await act(async () => {
      await result.current.completeOnboarding();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/ai-coach/trial-budget', { method: 'POST' });
    expect(result.current.budget.onboarding_completed).toBe(true);
  });

  it('completeOnboarding does not update state on non-ok response', async () => {
    // Initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...budgetResponse, onboarding_completed: false }),
    });

    const { result } = renderHook(() => useTrialBudget());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // POST returns 500
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await act(async () => {
      await result.current.completeOnboarding();
    });

    expect(result.current.budget.onboarding_completed).toBe(false);
  });

  it('completeOnboarding silently fails on error', async () => {
    // Initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...budgetResponse, onboarding_completed: false }),
    });

    const { result } = renderHook(() => useTrialBudget());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // POST fails
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      await result.current.completeOnboarding();
    });

    // Should not throw and state should remain unchanged
    expect(result.current.budget.onboarding_completed).toBe(false);
  });
});
