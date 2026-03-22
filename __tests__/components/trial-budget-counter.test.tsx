/**
 * Tests for TrialBudgetCounter component
 * Tests rendering for free users, destructive variant, upgrade button, and pro user hiding.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { TrialBudgetCounter } from '@/components/ai-coach/trial-budget-counter';
import { TRIAL_BUDGET } from '@/lib/constants/ai-limits';
import type { TrialBudgetState } from '@/types';

function makeBudget(overrides: Partial<TrialBudgetState> = {}): TrialBudgetState {
  return {
    analyses_used: 0,
    analyses_limit: TRIAL_BUDGET.LIMIT,
    analyses_remaining: TRIAL_BUDGET.LIMIT,
    is_pro: false,
    onboarding_completed: true,
    ...overrides,
  };
}

describe('TrialBudgetCounter', () => {
  it('renders remaining count for free users', () => {
    const budget = makeBudget({ analyses_remaining: 3 });
    render(<TrialBudgetCounter budget={budget} />);

    expect(screen.getByText(new RegExp(`3 of ${TRIAL_BUDGET.LIMIT} free analyses remaining`))).toBeInTheDocument();
  });

  it('shows destructive variant when 1 remaining', () => {
    const budget = makeBudget({ analyses_remaining: 1 });
    const { container } = render(<TrialBudgetCounter budget={budget} />);

    expect(screen.getByText(new RegExp(`1 of ${TRIAL_BUDGET.LIMIT} free analyses remaining`))).toBeInTheDocument();
    // The Badge component should have the destructive data attribute or class
    const badge = container.querySelector('[class*="destructive"]');
    expect(badge).not.toBeNull();
  });

  it('shows outline variant when 2+ remaining', () => {
    const budget = makeBudget({ analyses_remaining: 3 });
    const { container } = render(<TrialBudgetCounter budget={budget} />);

    // Should not have destructive styling
    const badge = container.querySelector('[class*="destructive"]');
    expect(badge).toBeNull();
  });

  it('shows "Upgrade to unlock" button when 0 remaining', () => {
    const budget = makeBudget({ analyses_remaining: 0, analyses_used: TRIAL_BUDGET.LIMIT });
    render(<TrialBudgetCounter budget={budget} />);

    const link = screen.getByText('Upgrade to unlock');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/dashboard/upgrade?highlight=ai-coach');
  });

  it('renders nothing when loading', () => {
    const budget = makeBudget();
    const { container } = render(<TrialBudgetCounter budget={budget} loading={true} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for pro users', () => {
    const budget = makeBudget({ is_pro: true, analyses_remaining: 999 });
    const { container } = render(<TrialBudgetCounter budget={budget} />);

    expect(container.firstChild).toBeNull();
  });
});
